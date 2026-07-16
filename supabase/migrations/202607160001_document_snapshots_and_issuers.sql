-- Per-document customer snapshots, immutable issuer identity, idempotency keys,
-- and strict product-id/SKU validation. Run after 202607150001_inventory_reporting.sql.

alter table public.invoices alter column customer_id drop not null;
alter table public.delivery_orders alter column customer_id drop not null;

alter table public.invoices
  add column if not exists customer_company_name text,
  add column if not exists customer_contact_person text,
  add column if not exists customer_contact_number text,
  add column if not exists billing_address text,
  add column if not exists delivery_address text,
  add column if not exists issued_by_user_id uuid references public.users(id),
  add column if not exists issued_by_display_name text,
  add column if not exists updated_by_user_id uuid references public.users(id),
  add column if not exists client_request_id uuid;

alter table public.delivery_orders
  add column if not exists customer_company_name text,
  add column if not exists customer_contact_person text,
  add column if not exists customer_contact_number text,
  add column if not exists billing_address text,
  add column if not exists issued_by_user_id uuid references public.users(id),
  add column if not exists issued_by_display_name text,
  add column if not exists updated_by_user_id uuid references public.users(id),
  add column if not exists client_request_id uuid;

create unique index if not exists invoices_client_request_unique
  on public.invoices(client_request_id) where client_request_id is not null;
create unique index if not exists delivery_orders_client_request_unique
  on public.delivery_orders(client_request_id) where client_request_id is not null;

update public.invoices i set
  customer_company_name=coalesce(i.customer_company_name,c.company_name),
  customer_contact_person=coalesce(i.customer_contact_person,c.contact_person),
  customer_contact_number=coalesce(i.customer_contact_number,c.contact_number),
  billing_address=coalesce(i.billing_address,c.billing_address),
  delivery_address=coalesce(i.delivery_address,c.delivery_address),
  issued_by_user_id=coalesce(i.issued_by_user_id,i.created_by),
  issued_by_display_name=coalesce(i.issued_by_display_name,(select u.full_name from public.users u where u.id=i.created_by),'Tesvila User')
from public.customers c
where i.customer_id=c.id;

update public.delivery_orders d set
  customer_company_name=coalesce(d.customer_company_name,c.company_name),
  customer_contact_person=coalesce(d.customer_contact_person,d.contact_person,c.contact_person),
  customer_contact_number=coalesce(d.customer_contact_number,d.contact_number,c.contact_number),
  billing_address=coalesce(d.billing_address,c.billing_address),
  issued_by_user_id=coalesce(d.issued_by_user_id,d.created_by),
  issued_by_display_name=coalesce(d.issued_by_display_name,(select u.full_name from public.users u where u.id=d.created_by),'Tesvila User')
from public.customers c
where d.customer_id=c.id;

create or replace function public.create_invoice_with_do(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c_id uuid; issuer_id uuid; request_id uuid; inv_id uuid; do_id uuid; inv_no text; do_no text;
  item jsonb; product_row products%rowtype; seq integer:=0; sub numeric:=0; rate numeric;
  tax numeric; total numeric; dep numeric; discount numeric;
begin
  if jsonb_array_length(coalesce(p_payload->'items','[]'::jsonb))<1 then raise exception 'At least one item is required'; end if;
  if nullif(trim(p_payload#>>'{customer,name}'),'') is null then raise exception 'Customer company is required'; end if;
  if nullif(trim(p_payload#>>'{customer,billingAddress}'),'') is null then raise exception 'Billing Address is required'; end if;
  c_id:=nullif(p_payload#>>'{customer,customerId}','')::uuid;
  if c_id is not null and not exists(select 1 from customers where id=c_id and deleted_at is null) then raise exception 'Selected customer was not found'; end if;
  issuer_id:=nullif(p_payload->>'issuedByUserId','')::uuid;
  request_id:=coalesce(nullif(p_payload->>'clientRequestId','')::uuid,gen_random_uuid());
  if exists(select 1 from invoices where client_request_id=request_id) then raise exception 'This invoice request was already saved'; end if;

  inv_no:=next_invoice_number();
  do_no:=next_do_number(coalesce((p_payload->>'invoiceDate')::date,current_date));
  rate:=coalesce((p_payload->>'gstRate')::numeric,9);
  dep:=coalesce((p_payload->>'deposit')::numeric,0);
  for item in select * from jsonb_array_elements(p_payload->'items') loop
    select * into product_row from products
      where id=nullif(item->>'productId','')::uuid and sku=item->>'sku' and deleted_at is null;
    if not found then raise exception 'Item %: Please select a valid SKU',seq+1; end if;
    discount:=coalesce((item->>'discount')::numeric,0);
    if (item->>'quantity')::numeric<=0 or (item->>'unitPrice')::numeric<0 or discount<0 then raise exception 'Item % has an invalid quantity, price, or discount',seq+1; end if;
    sub:=sub+round((item->>'quantity')::numeric*(item->>'unitPrice')::numeric-discount,2);
    seq:=seq+1;
  end loop;
  if sub<0 then raise exception 'Discount cannot exceed sales amount'; end if;
  tax:=round(sub*rate/100,2); total:=sub+tax;

  insert into invoices(invoice_number,invoice_date,customer_id,customer_company_name,customer_contact_person,
    customer_contact_number,billing_address,delivery_address,issued_by_user_id,issued_by_display_name,
    client_request_id,po_number,subtotal,gst_rate,gst_amount,grand_total,deposit,balance,payment_method,
    remarks,status,created_by)
  values(inv_no,(p_payload->>'invoiceDate')::date,c_id,p_payload#>>'{customer,name}',p_payload#>>'{customer,attention}',
    p_payload#>>'{customer,phone}',p_payload#>>'{customer,billingAddress}',p_payload#>>'{customer,deliveryAddress}',
    issuer_id,p_payload->>'issuedByDisplayName',request_id,p_payload->>'poNumber',sub,rate,tax,total,dep,total-dep,
    p_payload->>'paymentMethod',p_payload->>'remarks','issued',issuer_id) returning id into inv_id;

  insert into delivery_orders(do_number,delivery_date,customer_id,invoice_id,customer_company_name,
    customer_contact_person,customer_contact_number,billing_address,delivery_address,issued_by_user_id,
    issued_by_display_name,client_request_id,contact_person,contact_number,remarks,status,created_by)
  values(do_no,(p_payload->>'invoiceDate')::date,c_id,inv_id,p_payload#>>'{customer,name}',
    p_payload#>>'{customer,attention}',p_payload#>>'{customer,phone}',p_payload#>>'{customer,billingAddress}',
    coalesce(p_payload#>>'{customer,deliveryAddress}',''),issuer_id,p_payload->>'issuedByDisplayName',request_id,
    p_payload#>>'{customer,attention}',p_payload#>>'{customer,phone}',p_payload->>'remarks','scheduled',issuer_id)
  returning id into do_id;

  seq:=0;
  for item in select * from jsonb_array_elements(p_payload->'items') loop
    seq:=seq+1;
    select * into product_row from products where id=(item->>'productId')::uuid and sku=item->>'sku' and deleted_at is null;
    insert into invoice_items(invoice_id,line_order,product_id,product_model,sku,product_type,description,brand,
      quantity,unit_price,unit_cost,discount_amount,remarks)
    values(inv_id,seq,product_row.id,product_row.product_model,product_row.sku,product_row.product_type,
      product_row.description,product_row.brand,(item->>'quantity')::numeric,(item->>'unitPrice')::numeric,
      product_row.cost_price,coalesce((item->>'discount')::numeric,0),item->>'remarks');
    insert into delivery_order_items(delivery_order_id,line_order,product_id,product_model,sku,product_type,
      description,brand,quantity,unit_price,remarks)
    values(do_id,seq,product_row.id,product_row.product_model,product_row.sku,product_row.product_type,
      product_row.description,product_row.brand,(item->>'quantity')::numeric,(item->>'unitPrice')::numeric,item->>'remarks');
  end loop;
  insert into audit_logs(user_id,action,entity_type,entity_id,new_values)
    values(issuer_id,'document_created','invoice',inv_id,jsonb_build_object('invoice_number',inv_no,'do_number',do_no));
  return jsonb_build_object(
    'invoice',(p_payload-'type')||jsonb_build_object('id',inv_id,'invoiceNumber',inv_no,'doNumber',do_no,
      'doId',do_id,'createdBy',p_payload->>'issuedByDisplayName','issuedByUserId',issuer_id,'createdAt',now()),
    'deliveryOrder',jsonb_build_object('id',do_id,'doNumber',do_no,'deliveryDate',p_payload->>'invoiceDate',
      'customer',p_payload->'customer','invoiceNumber',inv_no,'invoiceId',inv_id,
      'deliveryAddress',p_payload#>>'{customer,deliveryAddress}','deliveryContact',p_payload#>>'{customer,attention}',
      'deliveryPhone',p_payload#>>'{customer,phone}','items',p_payload->'items','status','Scheduled',
      'remarks',p_payload->>'remarks','createdBy',p_payload->>'issuedByDisplayName','issuedByUserId',issuer_id,'createdAt',now()));
end $$;

create or replace function public.create_delivery_order_only(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c_id uuid; issuer_id uuid; request_id uuid; do_id uuid; do_no text; item jsonb;
  product_row products%rowtype; seq integer:=0;
begin
  if jsonb_array_length(coalesce(p_payload->'items','[]'::jsonb))<1 then raise exception 'At least one item is required'; end if;
  if nullif(trim(p_payload#>>'{customer,name}'),'') is null then raise exception 'Customer company is required'; end if;
  if nullif(trim(p_payload#>>'{customer,billingAddress}'),'') is null then raise exception 'Billing Address is required'; end if;
  c_id:=nullif(p_payload#>>'{customer,customerId}','')::uuid;
  if c_id is not null and not exists(select 1 from customers where id=c_id and deleted_at is null) then raise exception 'Selected customer was not found'; end if;
  issuer_id:=nullif(p_payload->>'issuedByUserId','')::uuid;
  request_id:=coalesce(nullif(p_payload->>'clientRequestId','')::uuid,gen_random_uuid());
  if exists(select 1 from delivery_orders where client_request_id=request_id) then raise exception 'This delivery-order request was already saved'; end if;
  do_no:=next_do_number(coalesce((p_payload->>'deliveryDate')::date,current_date));
  insert into delivery_orders(do_number,delivery_date,customer_id,customer_company_name,customer_contact_person,
    customer_contact_number,billing_address,delivery_address,issued_by_user_id,issued_by_display_name,
    client_request_id,contact_person,contact_number,remarks,status,created_by)
  values(do_no,(p_payload->>'deliveryDate')::date,c_id,p_payload#>>'{customer,name}',p_payload#>>'{customer,attention}',
    p_payload#>>'{customer,phone}',p_payload#>>'{customer,billingAddress}',coalesce(p_payload#>>'{customer,deliveryAddress}',''),
    issuer_id,p_payload->>'issuedByDisplayName',request_id,p_payload#>>'{customer,attention}',p_payload#>>'{customer,phone}',
    p_payload->>'remarks','scheduled',issuer_id) returning id into do_id;
  for item in select * from jsonb_array_elements(p_payload->'items') loop
    select * into product_row from products where id=nullif(item->>'productId','')::uuid and sku=item->>'sku' and deleted_at is null;
    if not found then raise exception 'Item %: Please select a valid SKU',seq+1; end if;
    if (item->>'quantity')::numeric<=0 then raise exception 'Item %: Quantity must be greater than zero',seq+1; end if;
    seq:=seq+1;
    insert into delivery_order_items(delivery_order_id,line_order,product_id,product_model,sku,product_type,
      description,brand,quantity,unit_price,remarks)
    values(do_id,seq,product_row.id,product_row.product_model,product_row.sku,product_row.product_type,
      product_row.description,product_row.brand,(item->>'quantity')::numeric,coalesce((item->>'unitPrice')::numeric,0),item->>'remarks');
  end loop;
  insert into audit_logs(user_id,action,entity_type,entity_id,new_values)
    values(issuer_id,'document_created','delivery_order',do_id,jsonb_build_object('do_number',do_no));
  return jsonb_build_object('deliveryOrder',(p_payload-'type')||jsonb_build_object('id',do_id,'doNumber',do_no,
    'createdBy',p_payload->>'issuedByDisplayName','issuedByUserId',issuer_id,'createdAt',now()));
end $$;

create or replace function public.update_invoice_document(p_id uuid,p_payload jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare inv invoices%rowtype; do_id uuid; c_id uuid; editor_id uuid; item jsonb; product_row products%rowtype;
  seq integer:=0; sub numeric:=0; tax numeric; total numeric; discount numeric;
begin
  select * into inv from invoices where id=p_id and deleted_at is null for update;
  if not found then raise exception 'Invoice not found'; end if;
  if jsonb_array_length(coalesce(p_payload->'items','[]'::jsonb))<1 then raise exception 'At least one item is required'; end if;
  if nullif(trim(p_payload#>>'{customer,name}'),'') is null then raise exception 'Customer company is required'; end if;
  if nullif(trim(p_payload#>>'{customer,billingAddress}'),'') is null then raise exception 'Billing Address is required'; end if;
  select id into do_id from delivery_orders where invoice_id=p_id and deleted_at is null for update;
  c_id:=nullif(p_payload#>>'{customer,customerId}','')::uuid;
  if c_id is not null and not exists(select 1 from customers where id=c_id and deleted_at is null) then raise exception 'Selected customer was not found'; end if;
  editor_id:=nullif(p_payload->>'updatedByUserId','')::uuid;
  for item in select * from jsonb_array_elements(p_payload->'items') loop
    select * into product_row from products where id=nullif(item->>'productId','')::uuid and sku=item->>'sku' and deleted_at is null;
    if not found then raise exception 'Item %: Please select a valid SKU',seq+1; end if;
    discount:=coalesce((item->>'discount')::numeric,0);
    if (item->>'quantity')::numeric<=0 or (item->>'unitPrice')::numeric<0 or discount<0 then raise exception 'Item % has an invalid quantity, price, or discount',seq+1; end if;
    sub:=sub+round((item->>'quantity')::numeric*(item->>'unitPrice')::numeric-discount,2); seq:=seq+1;
  end loop;
  tax:=round(sub*coalesce((p_payload->>'gstRate')::numeric,inv.gst_rate)/100,2); total:=sub+tax;
  update invoices set invoice_date=(p_payload->>'invoiceDate')::date,customer_id=c_id,
    customer_company_name=p_payload#>>'{customer,name}',customer_contact_person=p_payload#>>'{customer,attention}',
    customer_contact_number=p_payload#>>'{customer,phone}',billing_address=p_payload#>>'{customer,billingAddress}',
    delivery_address=p_payload#>>'{customer,deliveryAddress}',po_number=p_payload->>'poNumber',subtotal=sub,
    gst_rate=coalesce((p_payload->>'gstRate')::numeric,inv.gst_rate),gst_amount=tax,grand_total=total,
    deposit=coalesce((p_payload->>'deposit')::numeric,0),balance=total-coalesce((p_payload->>'deposit')::numeric,0),
    payment_method=p_payload->>'paymentMethod',remarks=p_payload->>'remarks',
    status=coalesce(lower(replace(p_payload->>'paymentStatus',' ','_'))::invoice_status,inv.status),
    updated_by_user_id=editor_id,updated_at=now() where id=p_id;
  if do_id is not null then delete from delivery_order_items where delivery_order_id=do_id; end if;
  delete from invoice_items where invoice_id=p_id;
  seq:=0;
  for item in select * from jsonb_array_elements(p_payload->'items') loop
    seq:=seq+1; select * into product_row from products where id=(item->>'productId')::uuid and sku=item->>'sku' and deleted_at is null;
    insert into invoice_items(invoice_id,line_order,product_id,product_model,sku,product_type,description,brand,quantity,unit_price,unit_cost,discount_amount,remarks)
    values(p_id,seq,product_row.id,product_row.product_model,product_row.sku,product_row.product_type,product_row.description,
      product_row.brand,(item->>'quantity')::numeric,(item->>'unitPrice')::numeric,product_row.cost_price,
      coalesce((item->>'discount')::numeric,0),item->>'remarks');
    if do_id is not null then
      insert into delivery_order_items(delivery_order_id,line_order,product_id,product_model,sku,product_type,description,brand,quantity,unit_price,remarks)
      values(do_id,seq,product_row.id,product_row.product_model,product_row.sku,product_row.product_type,product_row.description,
        product_row.brand,(item->>'quantity')::numeric,(item->>'unitPrice')::numeric,item->>'remarks');
    end if;
  end loop;
  if do_id is not null then update delivery_orders set customer_id=c_id,customer_company_name=p_payload#>>'{customer,name}',
    customer_contact_person=p_payload#>>'{customer,attention}',customer_contact_number=p_payload#>>'{customer,phone}',
    billing_address=p_payload#>>'{customer,billingAddress}',delivery_address=p_payload#>>'{customer,deliveryAddress}',
    contact_person=p_payload#>>'{customer,attention}',contact_number=p_payload#>>'{customer,phone}',updated_by_user_id=editor_id,updated_at=now()
    where id=do_id; end if;
  insert into audit_logs(user_id,action,entity_type,entity_id,new_values) values(editor_id,'document_edited','invoice',p_id,p_payload);
end $$;

create or replace function public.update_delivery_order_document(p_id uuid,p_payload jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare d delivery_orders%rowtype; c_id uuid; editor_id uuid; item jsonb; product_row products%rowtype; seq integer:=0;
begin
  select * into d from delivery_orders where id=p_id and deleted_at is null for update;
  if not found then raise exception 'Delivery order not found'; end if;
  if jsonb_array_length(coalesce(p_payload->'items','[]'::jsonb))<1 then raise exception 'At least one item is required'; end if;
  if nullif(trim(p_payload#>>'{customer,name}'),'') is null then raise exception 'Customer company is required'; end if;
  if nullif(trim(p_payload#>>'{customer,billingAddress}'),'') is null then raise exception 'Billing Address is required'; end if;
  c_id:=nullif(p_payload#>>'{customer,customerId}','')::uuid;
  if c_id is not null and not exists(select 1 from customers where id=c_id and deleted_at is null) then raise exception 'Selected customer was not found'; end if;
  editor_id:=nullif(p_payload->>'updatedByUserId','')::uuid;
  update delivery_orders set delivery_date=(p_payload->>'deliveryDate')::date,customer_id=c_id,
    customer_company_name=p_payload#>>'{customer,name}',customer_contact_person=p_payload#>>'{customer,attention}',
    customer_contact_number=p_payload#>>'{customer,phone}',billing_address=p_payload#>>'{customer,billingAddress}',
    delivery_address=p_payload#>>'{customer,deliveryAddress}',contact_person=p_payload#>>'{customer,attention}',
    contact_number=p_payload#>>'{customer,phone}',remarks=p_payload->>'remarks',
    status=lower(replace(p_payload->>'status',' ','_')),updated_by_user_id=editor_id,updated_at=now() where id=p_id;
  delete from delivery_order_items where delivery_order_id=p_id;
  for item in select * from jsonb_array_elements(p_payload->'items') loop
    select * into product_row from products where id=nullif(item->>'productId','')::uuid and sku=item->>'sku' and deleted_at is null;
    if not found then raise exception 'Item %: Please select a valid SKU',seq+1; end if;
    if (item->>'quantity')::numeric<=0 or coalesce((item->>'unitPrice')::numeric,0)<0 then
      raise exception 'Item % has an invalid quantity or price',seq+1;
    end if;
    seq:=seq+1;
    insert into delivery_order_items(delivery_order_id,line_order,product_id,product_model,sku,product_type,description,brand,quantity,unit_price,remarks)
    values(p_id,seq,product_row.id,product_row.product_model,product_row.sku,product_row.product_type,product_row.description,
      product_row.brand,(item->>'quantity')::numeric,coalesce((item->>'unitPrice')::numeric,0),item->>'remarks');
  end loop;
  insert into audit_logs(user_id,action,entity_type,entity_id,new_values) values(editor_id,'document_edited','delivery_order',p_id,p_payload);
end $$;

revoke all on function public.create_invoice_with_do(jsonb) from public;
revoke all on function public.create_delivery_order_only(jsonb) from public;
revoke all on function public.update_invoice_document(uuid,jsonb) from public;
revoke all on function public.update_delivery_order_document(uuid,jsonb) from public;
grant execute on function public.create_invoice_with_do(jsonb) to authenticated,service_role;
grant execute on function public.create_delivery_order_only(jsonb) to authenticated,service_role;
grant execute on function public.update_invoice_document(uuid,jsonb) to authenticated,service_role;
grant execute on function public.update_delivery_order_document(uuid,jsonb) to authenticated,service_role;
