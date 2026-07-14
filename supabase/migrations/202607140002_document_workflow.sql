-- Database-first document save functions. Each function runs as one PostgreSQL transaction.
create or replace function public.create_invoice_with_do(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c_id uuid; inv_id uuid; do_id uuid; inv_no text; do_no text; item jsonb; seq integer:=0; sub numeric:=0; rate numeric; tax numeric; total numeric; dep numeric;
begin
 if jsonb_array_length(p_payload->'items')<1 then raise exception 'At least one item is required'; end if;
 select id into c_id from customers where lower(company_name)=lower(p_payload#>>'{customer,name}') and deleted_at is null limit 1;
 if c_id is null then
  insert into customers(customer_code,company_name,contact_person,contact_number,billing_address,delivery_address)
  values('CUS-'||to_char(clock_timestamp(),'YYMMDDHH24MISSMS'),p_payload#>>'{customer,name}',p_payload#>>'{customer,attention}',p_payload#>>'{customer,phone}',p_payload#>>'{customer,address}',p_payload#>>'{customer,address}') returning id into c_id;
 end if;
 inv_no:=next_invoice_number(); do_no:=next_do_number(coalesce((p_payload->>'invoiceDate')::date,current_date)); rate:=coalesce((p_payload->>'gstRate')::numeric,9); dep:=coalesce((p_payload->>'deposit')::numeric,0);
 for item in select * from jsonb_array_elements(p_payload->'items') loop
  if (item->>'quantity')::numeric<=0 or (item->>'unitPrice')::numeric<0 then raise exception 'Quantity must be positive and unit price cannot be negative'; end if;
  sub:=sub+round((item->>'quantity')::numeric*(item->>'unitPrice')::numeric,2);
 end loop;
 tax:=round(sub*rate/100,2); total:=sub+tax;
 insert into invoices(invoice_number,invoice_date,customer_id,po_number,subtotal,gst_rate,gst_amount,grand_total,deposit,balance,payment_method,remarks,status,created_by)
 values(inv_no,(p_payload->>'invoiceDate')::date,c_id,p_payload->>'poNumber',sub,rate,tax,total,dep,total-dep,p_payload->>'paymentMethod',p_payload->>'remarks','issued',auth.uid()) returning id into inv_id;
 insert into delivery_orders(do_number,delivery_date,customer_id,invoice_id,delivery_address,contact_person,contact_number,remarks,status,created_by)
 values(do_no,(p_payload->>'invoiceDate')::date,c_id,inv_id,p_payload#>>'{customer,address}',p_payload#>>'{customer,attention}',p_payload#>>'{customer,phone}',p_payload->>'remarks','scheduled',auth.uid()) returning id into do_id;
 for item in select * from jsonb_array_elements(p_payload->'items') loop
  seq:=seq+1;
  insert into invoice_items(invoice_id,line_order,product_id,product_model,sku,product_type,description,brand,quantity,unit_price,unit_cost,remarks)
  values(inv_id,seq,(select id from products where sku=item->>'sku' limit 1),item->>'model',item->>'sku',item->>'type',item->>'description',item->>'brand',(item->>'quantity')::numeric,(item->>'unitPrice')::numeric,coalesce((select cost_price from products where sku=item->>'sku' limit 1),0),item->>'remarks');
  insert into delivery_order_items(delivery_order_id,line_order,product_id,product_model,sku,product_type,description,brand,quantity,unit_price,remarks)
  values(do_id,seq,(select id from products where sku=item->>'sku' limit 1),item->>'model',item->>'sku',item->>'type',item->>'description',item->>'brand',(item->>'quantity')::numeric,(item->>'unitPrice')::numeric,item->>'remarks');
 end loop;
 insert into audit_logs(user_id,action,entity_type,entity_id,new_values) values(auth.uid(),'document_created','invoice',inv_id,jsonb_build_object('invoice_number',inv_no,'do_number',do_no));
 return jsonb_build_object('invoice',(p_payload-'type')||jsonb_build_object('id',inv_id,'invoiceNumber',inv_no,'doNumber',do_no,'doId',do_id,'createdAt',now()),'deliveryOrder',jsonb_build_object('id',do_id,'doNumber',do_no,'deliveryDate',p_payload->>'invoiceDate','customer',p_payload->'customer','invoiceNumber',inv_no,'invoiceId',inv_id,'deliveryAddress',p_payload#>>'{customer,address}','deliveryContact',p_payload#>>'{customer,attention}','deliveryPhone',p_payload#>>'{customer,phone}','items',p_payload->'items','status','Scheduled','remarks',p_payload->>'remarks','createdBy',p_payload->>'createdBy','createdAt',now()));
end $$;

create or replace function public.create_delivery_order_only(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c_id uuid; do_id uuid; do_no text; item jsonb; seq integer:=0;
begin
 if jsonb_array_length(p_payload->'items')<1 then raise exception 'At least one item is required'; end if;
 select id into c_id from customers where lower(company_name)=lower(p_payload#>>'{customer,name}') and deleted_at is null limit 1;
 if c_id is null then insert into customers(customer_code,company_name,contact_person,contact_number,billing_address,delivery_address) values('CUS-'||to_char(clock_timestamp(),'YYMMDDHH24MISSMS'),p_payload#>>'{customer,name}',p_payload#>>'{customer,attention}',p_payload#>>'{customer,phone}',p_payload#>>'{customer,address}',p_payload->>'deliveryAddress') returning id into c_id; end if;
 do_no:=next_do_number(coalesce((p_payload->>'deliveryDate')::date,current_date));
 insert into delivery_orders(do_number,delivery_date,customer_id,delivery_address,contact_person,contact_number,remarks,status,created_by)
 values(do_no,(p_payload->>'deliveryDate')::date,c_id,p_payload->>'deliveryAddress',p_payload->>'deliveryContact',p_payload->>'deliveryPhone',p_payload->>'remarks','scheduled',auth.uid()) returning id into do_id;
 for item in select * from jsonb_array_elements(p_payload->'items') loop
  if (item->>'quantity')::numeric<=0 then raise exception 'Quantity must be positive'; end if; seq:=seq+1;
  insert into delivery_order_items(delivery_order_id,line_order,product_id,product_model,sku,product_type,description,brand,quantity,unit_price,remarks)
  values(do_id,seq,(select id from products where sku=item->>'sku' limit 1),item->>'model',item->>'sku',item->>'type',item->>'description',item->>'brand',(item->>'quantity')::numeric,coalesce((item->>'unitPrice')::numeric,0),item->>'remarks');
 end loop;
 insert into audit_logs(user_id,action,entity_type,entity_id,new_values) values(auth.uid(),'document_created','delivery_order',do_id,jsonb_build_object('do_number',do_no));
 return jsonb_build_object('deliveryOrder',(p_payload-'type')||jsonb_build_object('id',do_id,'doNumber',do_no,'createdAt',now()));
end $$;

revoke all on function public.create_invoice_with_do(jsonb) from public;
revoke all on function public.create_delivery_order_only(jsonb) from public;
grant execute on function public.create_invoice_with_do(jsonb) to authenticated,service_role;
grant execute on function public.create_delivery_order_only(jsonb) to authenticated,service_role;

create or replace function public.update_invoice_document(p_id uuid,p_payload jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare inv invoices%rowtype; do_id uuid; item jsonb; seq integer:=0; sub numeric:=0; tax numeric; total numeric;
begin
 select * into inv from invoices where id=p_id and deleted_at is null for update; if not found then raise exception 'Invoice not found'; end if;
 select id into do_id from delivery_orders where invoice_id=p_id and deleted_at is null for update;
 update customers set company_name=p_payload#>>'{customer,name}',billing_address=p_payload#>>'{customer,address}',contact_person=p_payload#>>'{customer,attention}',contact_number=p_payload#>>'{customer,phone}',updated_at=now() where id=inv.customer_id;
 for item in select * from jsonb_array_elements(p_payload->'items') loop if (item->>'quantity')::numeric<=0 or (item->>'unitPrice')::numeric<0 then raise exception 'Invalid item quantity or price'; end if; sub:=sub+round((item->>'quantity')::numeric*(item->>'unitPrice')::numeric,2); end loop;
 tax:=round(sub*coalesce((p_payload->>'gstRate')::numeric,inv.gst_rate)/100,2);total:=sub+tax;
 update invoices set invoice_date=(p_payload->>'invoiceDate')::date,po_number=p_payload->>'poNumber',subtotal=sub,gst_rate=(p_payload->>'gstRate')::numeric,gst_amount=tax,grand_total=total,deposit=(p_payload->>'deposit')::numeric,balance=total-(p_payload->>'deposit')::numeric,payment_method=p_payload->>'paymentMethod',remarks=p_payload->>'remarks',updated_at=now() where id=p_id;
 delete from invoice_items where invoice_id=p_id; if do_id is not null then delete from delivery_order_items where delivery_order_id=do_id; end if;
 for item in select * from jsonb_array_elements(p_payload->'items') loop seq:=seq+1;
  insert into invoice_items(invoice_id,line_order,product_id,product_model,sku,product_type,description,brand,quantity,unit_price,unit_cost,remarks) values(p_id,seq,(select id from products where sku=item->>'sku' limit 1),item->>'model',item->>'sku',item->>'type',item->>'description',item->>'brand',(item->>'quantity')::numeric,(item->>'unitPrice')::numeric,coalesce((select cost_price from products where sku=item->>'sku' limit 1),0),item->>'remarks');
  if do_id is not null then insert into delivery_order_items(delivery_order_id,line_order,product_id,product_model,sku,product_type,description,brand,quantity,unit_price,remarks) values(do_id,seq,(select id from products where sku=item->>'sku' limit 1),item->>'model',item->>'sku',item->>'type',item->>'description',item->>'brand',(item->>'quantity')::numeric,(item->>'unitPrice')::numeric,item->>'remarks'); end if;
 end loop;
 if do_id is not null then update delivery_orders set delivery_address=p_payload#>>'{customer,address}',contact_person=p_payload#>>'{customer,attention}',contact_number=p_payload#>>'{customer,phone}',updated_at=now() where id=do_id; end if;
 insert into audit_logs(user_id,action,entity_type,entity_id,new_values) values(auth.uid(),'document_edited','invoice',p_id,p_payload);
end $$;

create or replace function public.update_delivery_order_document(p_id uuid,p_payload jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare d delivery_orders%rowtype; item jsonb; seq integer:=0;
begin
 select * into d from delivery_orders where id=p_id and deleted_at is null for update; if not found then raise exception 'Delivery order not found'; end if;
 update customers set company_name=p_payload#>>'{customer,name}',billing_address=p_payload#>>'{customer,address}',contact_person=p_payload#>>'{customer,attention}',contact_number=p_payload#>>'{customer,phone}',updated_at=now() where id=d.customer_id;
 update delivery_orders set delivery_date=(p_payload->>'deliveryDate')::date,delivery_address=p_payload->>'deliveryAddress',contact_person=p_payload->>'deliveryContact',contact_number=p_payload->>'deliveryPhone',remarks=p_payload->>'remarks',status=lower(replace(p_payload->>'status',' ','_')),updated_at=now() where id=p_id;
 delete from delivery_order_items where delivery_order_id=p_id;
 for item in select * from jsonb_array_elements(p_payload->'items') loop if (item->>'quantity')::numeric<=0 then raise exception 'Quantity must be positive'; end if;seq:=seq+1;insert into delivery_order_items(delivery_order_id,line_order,product_id,product_model,sku,product_type,description,brand,quantity,unit_price,remarks) values(p_id,seq,(select id from products where sku=item->>'sku' limit 1),item->>'model',item->>'sku',item->>'type',item->>'description',item->>'brand',(item->>'quantity')::numeric,coalesce((item->>'unitPrice')::numeric,0),item->>'remarks');end loop;
 insert into audit_logs(user_id,action,entity_type,entity_id,new_values) values(auth.uid(),'document_edited','delivery_order',p_id,p_payload);
end $$;

revoke all on function public.update_invoice_document(uuid,jsonb) from public;
revoke all on function public.update_delivery_order_document(uuid,jsonb) from public;
grant execute on function public.update_invoice_document(uuid,jsonb) to authenticated,service_role;
grant execute on function public.update_delivery_order_document(uuid,jsonb) to authenticated,service_role;
