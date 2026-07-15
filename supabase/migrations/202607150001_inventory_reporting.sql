-- Transactional inventory and reporting support.
-- Delivery-order item changes are the single source of truth for stock deduction.

alter table public.invoice_items
  add column if not exists discount_amount numeric(14,2) not null default 0
  check (discount_amount >= 0);

alter table public.stock_movements
  add column if not exists quantity_before numeric(14,3),
  add column if not exists quantity_after numeric(14,3),
  add column if not exists source_item_id uuid,
  add column if not exists reversal_of uuid references public.stock_movements(id),
  add column if not exists active boolean not null default true;

update public.stock_movements
set quantity_after = coalesce(quantity_after, balance_after),
    quantity_before = coalesce(quantity_before, balance_after - quantity)
where quantity_before is null or quantity_after is null;

-- Reconcile legacy product balances once so the formula remains auditable.
insert into public.stock_movements(product_id,movement_type,quantity,balance_after,
  quantity_before,quantity_after,reference_type,remarks,active)
select p.id,
  case when p.current_stock-p.opening_stock >= 0 then 'incoming'::stock_movement_type else 'outgoing'::stock_movement_type end,
  p.current_stock-p.opening_stock,p.current_stock,p.opening_stock,p.current_stock,
  'opening_reconciliation','Automatic one-time reconciliation of the pre-migration balance',true
from products p
where p.current_stock<>p.opening_stock
  and not exists(select 1 from stock_movements m where m.product_id=p.id);

create unique index if not exists stock_active_do_item_idx
  on public.stock_movements(source_item_id)
  where source_item_id is not null and active;

create or replace function public.apply_delivery_order_item_stock(p_item_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare i public.delivery_order_items%rowtype; d public.delivery_orders%rowtype;
        before_qty numeric; after_qty numeric; movement_id uuid;
begin
  select * into i from delivery_order_items where id=p_item_id;
  if not found then raise exception 'Delivery order item not found'; end if;
  if i.product_id is null then raise exception 'SKU % is not linked to a product', i.sku; end if;
  select * into d from delivery_orders where id=i.delivery_order_id;
  if d.deleted_at is not null or d.status='cancelled' then return; end if;
  if exists(select 1 from stock_movements where source_item_id=i.id and active) then return; end if;

  select current_stock into before_qty from products where id=i.product_id for update;
  if before_qty is null then raise exception 'Product for SKU % was not found', i.sku; end if;
  if before_qty < i.quantity then
    raise exception 'Insufficient inventory for SKU % (available %, requested %)', i.sku, before_qty, i.quantity;
  end if;
  after_qty := before_qty-i.quantity;
  update products set current_stock=after_qty,updated_at=now() where id=i.product_id;
  insert into stock_movements(product_id,movement_type,quantity,balance_after,
    quantity_before,quantity_after,reference_type,reference_id,reference_number,
    source_item_id,remarks,created_by)
  values(i.product_id,'outgoing',-i.quantity,after_qty,before_qty,after_qty,
    'delivery_order',d.id,d.do_number,i.id,'Automatic deduction from saved delivery order',auth.uid())
  returning id into movement_id;
end $$;

create or replace function public.reverse_delivery_order_item_stock(p_item_id uuid, p_reason text default 'Delivery order changed')
returns void language plpgsql security definer set search_path=public as $$
declare m public.stock_movements%rowtype; before_qty numeric; after_qty numeric;
begin
  select * into m from stock_movements
  where source_item_id=p_item_id and active order by created_at desc limit 1 for update;
  if not found then return; end if;
  select current_stock into before_qty from products where id=m.product_id for update;
  after_qty := before_qty + abs(m.quantity);
  update products set current_stock=after_qty,updated_at=now() where id=m.product_id;
  update stock_movements set active=false where id=m.id;
  insert into stock_movements(product_id,movement_type,quantity,balance_after,
    quantity_before,quantity_after,reference_type,reference_id,reference_number,
    reversal_of,active,remarks,created_by)
  values(m.product_id,'returned',abs(m.quantity),after_qty,before_qty,after_qty,
    'delivery_order_reversal',m.reference_id,m.reference_number,m.id,false,p_reason,auth.uid());
end $$;

create or replace function public.delivery_order_item_inventory_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    perform apply_delivery_order_item_stock(new.id);
    return new;
  elsif tg_op='DELETE' then
    perform reverse_delivery_order_item_stock(old.id,'Delivery order item removed or replaced');
    return old;
  else
    if old.product_id is distinct from new.product_id or old.quantity is distinct from new.quantity then
      perform reverse_delivery_order_item_stock(old.id,'Delivery order item edited');
      perform apply_delivery_order_item_stock(new.id);
    end if;
    return new;
  end if;
end $$;

drop trigger if exists delivery_order_item_inventory on public.delivery_order_items;
create trigger delivery_order_item_inventory
after insert or update of product_id,quantity or delete on public.delivery_order_items
for each row execute function public.delivery_order_item_inventory_trigger();

revoke all on function public.apply_delivery_order_item_stock(uuid) from public;
revoke all on function public.reverse_delivery_order_item_stock(uuid,text) from public;
revoke all on function public.delivery_order_item_inventory_trigger() from public;
grant execute on function public.apply_delivery_order_item_stock(uuid) to service_role;
grant execute on function public.reverse_delivery_order_item_stock(uuid,text) to service_role;

create or replace function public.record_stock_movement(
  p_product_id uuid, p_movement_type text, p_quantity numeric,
  p_reference_number text default null, p_remarks text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare before_qty numeric; after_qty numeric; signed_qty numeric; movement_id uuid;
begin
  if p_movement_type not in ('incoming','damaged','returned') then
    raise exception 'Movement type must be incoming, damaged, or returned';
  end if;
  if p_quantity <= 0 then raise exception 'Quantity must be positive'; end if;
  select current_stock into before_qty from products where id=p_product_id and deleted_at is null for update;
  if before_qty is null then raise exception 'Product not found'; end if;
  signed_qty := case when p_movement_type='damaged' then -p_quantity else p_quantity end;
  after_qty := before_qty+signed_qty;
  if after_qty < 0 then raise exception 'Insufficient stock'; end if;
  update products set current_stock=after_qty,updated_at=now() where id=p_product_id;
  insert into stock_movements(product_id,movement_type,quantity,balance_after,
    quantity_before,quantity_after,reference_type,reference_number,remarks,created_by)
  values(p_product_id,p_movement_type::stock_movement_type,signed_qty,after_qty,
    before_qty,after_qty,'manual',p_reference_number,p_remarks,auth.uid()) returning id into movement_id;
  return jsonb_build_object('id',movement_id,'quantityBefore',before_qty,'quantityAfter',after_qty);
end $$;

create or replace function public.soft_delete_document(p_type text,p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare item_id uuid; linked_do uuid;
begin
  if p_type='delivery_order' then
    for item_id in select id from delivery_order_items where delivery_order_id=p_id loop
      perform reverse_delivery_order_item_stock(item_id,'Delivery order deleted or cancelled');
    end loop;
    update delivery_orders set deleted_at=now(),status='cancelled',updated_at=now() where id=p_id and deleted_at is null;
  elsif p_type='invoice' then
    select id into linked_do from delivery_orders where invoice_id=p_id and deleted_at is null;
    if linked_do is not null then perform soft_delete_document('delivery_order',linked_do); end if;
    update invoices set deleted_at=now(),status='void',updated_at=now() where id=p_id and deleted_at is null;
  else
    raise exception 'Unknown document type';
  end if;
  insert into audit_logs(user_id,action,entity_type,entity_id,new_values)
  values(auth.uid(),'document_deleted',p_type,p_id,jsonb_build_object('soft_deleted',true,'inventory_reversed',true));
end $$;

revoke all on function public.record_stock_movement(uuid,text,numeric,text,text) from public;
revoke all on function public.soft_delete_document(text,uuid) from public;
grant execute on function public.record_stock_movement(uuid,text,numeric,text,text) to authenticated,service_role;
grant execute on function public.soft_delete_document(text,uuid) to authenticated,service_role;

-- Replace invoice functions so discounts and historical unit-cost snapshots are atomic.
create or replace function public.create_invoice_with_do(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c_id uuid; inv_id uuid; do_id uuid; inv_no text; do_no text; item jsonb;
  seq integer:=0; sub numeric:=0; rate numeric; tax numeric; total numeric; dep numeric; discount numeric;
begin
  if jsonb_array_length(p_payload->'items')<1 then raise exception 'At least one item is required'; end if;
  select id into c_id from customers where lower(company_name)=lower(p_payload#>>'{customer,name}') and deleted_at is null limit 1;
  if c_id is null then
    insert into customers(customer_code,company_name,contact_person,contact_number,billing_address,delivery_address)
    values('CUS-'||to_char(clock_timestamp(),'YYMMDDHH24MISSMS'),p_payload#>>'{customer,name}',p_payload#>>'{customer,attention}',p_payload#>>'{customer,phone}',p_payload#>>'{customer,address}',p_payload#>>'{customer,address}') returning id into c_id;
  end if;
  inv_no:=next_invoice_number(); do_no:=next_do_number(coalesce((p_payload->>'invoiceDate')::date,current_date));
  rate:=coalesce((p_payload->>'gstRate')::numeric,9); dep:=coalesce((p_payload->>'deposit')::numeric,0);
  for item in select * from jsonb_array_elements(p_payload->'items') loop
    discount:=coalesce((item->>'discount')::numeric,0);
    if (item->>'quantity')::numeric<=0 or (item->>'unitPrice')::numeric<0 or discount<0 then raise exception 'Invalid item quantity, price, or discount'; end if;
    sub:=sub+round((item->>'quantity')::numeric*(item->>'unitPrice')::numeric-discount,2);
  end loop;
  if sub<0 then raise exception 'Discount cannot exceed sales amount'; end if;
  tax:=round(sub*rate/100,2); total:=sub+tax;
  insert into invoices(invoice_number,invoice_date,customer_id,po_number,subtotal,gst_rate,gst_amount,grand_total,deposit,balance,payment_method,remarks,status,created_by)
  values(inv_no,(p_payload->>'invoiceDate')::date,c_id,p_payload->>'poNumber',sub,rate,tax,total,dep,total-dep,p_payload->>'paymentMethod',p_payload->>'remarks','issued',auth.uid()) returning id into inv_id;
  insert into delivery_orders(do_number,delivery_date,customer_id,invoice_id,delivery_address,contact_person,contact_number,remarks,status,created_by)
  values(do_no,(p_payload->>'invoiceDate')::date,c_id,inv_id,p_payload#>>'{customer,address}',p_payload#>>'{customer,attention}',p_payload#>>'{customer,phone}',p_payload->>'remarks','scheduled',auth.uid()) returning id into do_id;
  for item in select * from jsonb_array_elements(p_payload->'items') loop seq:=seq+1;
    insert into invoice_items(invoice_id,line_order,product_id,product_model,sku,product_type,description,brand,quantity,unit_price,unit_cost,discount_amount,remarks)
    values(inv_id,seq,(select id from products where sku=item->>'sku' and deleted_at is null limit 1),item->>'model',item->>'sku',item->>'type',item->>'description',item->>'brand',(item->>'quantity')::numeric,(item->>'unitPrice')::numeric,coalesce((select cost_price from products where sku=item->>'sku' and deleted_at is null limit 1),0),coalesce((item->>'discount')::numeric,0),item->>'remarks');
    insert into delivery_order_items(delivery_order_id,line_order,product_id,product_model,sku,product_type,description,brand,quantity,unit_price,remarks)
    values(do_id,seq,(select id from products where sku=item->>'sku' and deleted_at is null limit 1),item->>'model',item->>'sku',item->>'type',item->>'description',item->>'brand',(item->>'quantity')::numeric,(item->>'unitPrice')::numeric,item->>'remarks');
  end loop;
  insert into audit_logs(user_id,action,entity_type,entity_id,new_values) values(auth.uid(),'document_created','invoice',inv_id,jsonb_build_object('invoice_number',inv_no,'do_number',do_no));
  return jsonb_build_object('invoice',(p_payload-'type')||jsonb_build_object('id',inv_id,'invoiceNumber',inv_no,'doNumber',do_no,'doId',do_id,'createdAt',now()),'deliveryOrder',jsonb_build_object('id',do_id,'doNumber',do_no,'deliveryDate',p_payload->>'invoiceDate','customer',p_payload->'customer','invoiceNumber',inv_no,'invoiceId',inv_id,'deliveryAddress',p_payload#>>'{customer,address}','deliveryContact',p_payload#>>'{customer,attention}','deliveryPhone',p_payload#>>'{customer,phone}','items',p_payload->'items','status','Scheduled','remarks',p_payload->>'remarks','createdBy',p_payload->>'createdBy','createdAt',now()));
end $$;

create or replace function public.update_invoice_document(p_id uuid,p_payload jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare inv invoices%rowtype; do_id uuid; item jsonb; seq integer:=0; sub numeric:=0;
  tax numeric; total numeric; discount numeric; saved_cost numeric;
begin
  select * into inv from invoices where id=p_id and deleted_at is null for update;
  if not found then raise exception 'Invoice not found'; end if;
  select id into do_id from delivery_orders where invoice_id=p_id and deleted_at is null for update;
  update customers set company_name=p_payload#>>'{customer,name}',billing_address=p_payload#>>'{customer,address}',contact_person=p_payload#>>'{customer,attention}',contact_number=p_payload#>>'{customer,phone}',updated_at=now() where id=inv.customer_id;
  for item in select * from jsonb_array_elements(p_payload->'items') loop
    discount:=coalesce((item->>'discount')::numeric,0);
    if (item->>'quantity')::numeric<=0 or (item->>'unitPrice')::numeric<0 or discount<0 then raise exception 'Invalid item quantity, price, or discount'; end if;
    sub:=sub+round((item->>'quantity')::numeric*(item->>'unitPrice')::numeric-discount,2);
  end loop;
  if sub<0 then raise exception 'Discount cannot exceed sales amount'; end if;
  tax:=round(sub*coalesce((p_payload->>'gstRate')::numeric,inv.gst_rate)/100,2); total:=sub+tax;
  update invoices set invoice_date=(p_payload->>'invoiceDate')::date,po_number=p_payload->>'poNumber',subtotal=sub,gst_rate=coalesce((p_payload->>'gstRate')::numeric,inv.gst_rate),gst_amount=tax,grand_total=total,deposit=coalesce((p_payload->>'deposit')::numeric,0),balance=total-coalesce((p_payload->>'deposit')::numeric,0),payment_method=p_payload->>'paymentMethod',remarks=p_payload->>'remarks',status=coalesce(lower(replace(p_payload->>'paymentStatus',' ','_'))::invoice_status,inv.status),updated_at=now() where id=p_id;
  if do_id is not null then delete from delivery_order_items where delivery_order_id=do_id; end if;
  delete from invoice_items where invoice_id=p_id;
  for item in select * from jsonb_array_elements(p_payload->'items') loop seq:=seq+1;
    saved_cost:=coalesce((item->>'unitCost')::numeric,(select cost_price from products where sku=item->>'sku' and deleted_at is null limit 1),0);
    insert into invoice_items(invoice_id,line_order,product_id,product_model,sku,product_type,description,brand,quantity,unit_price,unit_cost,discount_amount,remarks)
    values(p_id,seq,(select id from products where sku=item->>'sku' and deleted_at is null limit 1),item->>'model',item->>'sku',item->>'type',item->>'description',item->>'brand',(item->>'quantity')::numeric,(item->>'unitPrice')::numeric,saved_cost,coalesce((item->>'discount')::numeric,0),item->>'remarks');
    if do_id is not null then insert into delivery_order_items(delivery_order_id,line_order,product_id,product_model,sku,product_type,description,brand,quantity,unit_price,remarks) values(do_id,seq,(select id from products where sku=item->>'sku' and deleted_at is null limit 1),item->>'model',item->>'sku',item->>'type',item->>'description',item->>'brand',(item->>'quantity')::numeric,(item->>'unitPrice')::numeric,item->>'remarks'); end if;
  end loop;
  if do_id is not null then update delivery_orders set delivery_address=p_payload#>>'{customer,address}',contact_person=p_payload#>>'{customer,attention}',contact_number=p_payload#>>'{customer,phone}',updated_at=now() where id=do_id; end if;
  insert into audit_logs(user_id,action,entity_type,entity_id,new_values) values(auth.uid(),'document_edited','invoice',p_id,p_payload);
end $$;

grant execute on function public.create_invoice_with_do(jsonb) to authenticated,service_role;
grant execute on function public.update_invoice_document(uuid,jsonb) to authenticated,service_role;
