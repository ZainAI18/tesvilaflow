-- One Invoice may have many Delivery Orders. Each Delivery Order remains linked
-- to at most one nullable Invoice, and each linked DO item points to its source
-- Invoice item so remaining quantities can be enforced transactionally.

drop index if exists public.delivery_orders_one_active_invoice_unique;

alter table public.delivery_order_items
  add column if not exists invoice_item_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'delivery_order_items_invoice_item_id_fkey'
      and conrelid = 'public.delivery_order_items'::regclass
  ) then
    alter table public.delivery_order_items
      add constraint delivery_order_items_invoice_item_id_fkey
      foreign key (invoice_item_id) references public.invoice_items(id);
  end if;
end $$;

create index if not exists delivery_order_items_invoice_item_idx
  on public.delivery_order_items(invoice_item_id)
  where invoice_item_id is not null;

-- Existing Invoice + DO records were created as matching line snapshots. Link
-- those historical rows before enabling item-level remaining calculations.
update public.delivery_order_items as delivery_item
set invoice_item_id = invoice_item.id
from public.delivery_orders as delivery_order,
     public.invoice_items as invoice_item
where delivery_item.delivery_order_id = delivery_order.id
  and delivery_order.invoice_id = invoice_item.invoice_id
  and delivery_item.line_order = invoice_item.line_order
  and delivery_item.invoice_item_id is null;

create or replace function public.validate_invoice_delivery_quantities(p_invoice_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
  over_item record;
begin
  -- Serialize concurrent Delivery Order saves for the same Invoice.
  perform 1
  from public.invoices
  where id = p_invoice_id and deleted_at is null
  for update;
  if not found then
    raise exception 'Selected Invoice was not found';
  end if;

  if exists (
    select 1
    from public.delivery_order_items as delivery_item
    join public.delivery_orders as delivery_order
      on delivery_order.id = delivery_item.delivery_order_id
    where delivery_order.invoice_id = p_invoice_id
      and delivery_order.deleted_at is null
      and delivery_order.status <> 'cancelled'
      and (
        delivery_item.invoice_item_id is null
        or not exists (
          select 1 from public.invoice_items as invoice_item
          where invoice_item.id = delivery_item.invoice_item_id
            and invoice_item.invoice_id = p_invoice_id
        )
      )
  ) then
    raise exception 'Every linked Delivery Order item must reference an item from the selected Invoice';
  end if;

  select invoice_item.sku,
         invoice_item.quantity as invoice_quantity,
         coalesce(sum(
           case when delivery_order.id is not null then delivery_item.quantity else 0 end
         ), 0) as delivered_quantity
  into over_item
  from public.invoice_items as invoice_item
  left join public.delivery_order_items as delivery_item
    on delivery_item.invoice_item_id = invoice_item.id
  left join public.delivery_orders as delivery_order
    on delivery_order.id = delivery_item.delivery_order_id
   and delivery_order.invoice_id = p_invoice_id
   and delivery_order.deleted_at is null
   and delivery_order.status <> 'cancelled'
  where invoice_item.invoice_id = p_invoice_id
  group by invoice_item.id, invoice_item.sku, invoice_item.quantity
  having coalesce(sum(
    case when delivery_order.id is not null then delivery_item.quantity else 0 end
  ), 0) > invoice_item.quantity
  limit 1;

  if found then
    raise exception 'SKU %: Delivery quantity % exceeds Invoice quantity %',
      over_item.sku, over_item.delivered_quantity, over_item.invoice_quantity;
  end if;
end $$;

create or replace function public.create_invoice_with_do_v7(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  result jsonb;
  v_invoice_id uuid;
  v_delivery_order_id uuid;
begin
  result := public.create_invoice_with_do_v5(p_payload);
  v_invoice_id := (result#>>'{invoice,id}')::uuid;
  v_delivery_order_id := (result#>>'{deliveryOrder,id}')::uuid;

  update public.delivery_order_items as delivery_item
  set invoice_item_id = invoice_item.id
  from public.invoice_items as invoice_item
  where delivery_item.delivery_order_id = v_delivery_order_id
    and invoice_item.invoice_id = v_invoice_id
    and invoice_item.line_order = delivery_item.line_order;

  perform public.validate_invoice_delivery_quantities(v_invoice_id);
  return result;
end $$;

create or replace function public.create_invoice_only_v7(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  return public.create_invoice_only_v6(p_payload);
end $$;

create or replace function public.create_delivery_order_only_v7(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  result jsonb;
  v_delivery_order_id uuid;
  v_invoice_id uuid := nullif(p_payload->>'invoiceId', '')::uuid;
begin
  result := public.create_delivery_order_only_v5(p_payload);
  v_delivery_order_id := (result#>>'{deliveryOrder,id}')::uuid;

  if v_invoice_id is not null then
    update public.delivery_order_items as delivery_item
    set invoice_item_id = nullif(payload_item.value->>'invoiceItemId', '')::uuid
    from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb))
         with ordinality as payload_item(value, line_order)
    where delivery_item.delivery_order_id = v_delivery_order_id
      and delivery_item.line_order = payload_item.line_order;

    perform public.validate_invoice_delivery_quantities(v_invoice_id);
  end if;
  return result;
end $$;

create or replace function public.update_invoice_document_v7(p_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare
  inv public.invoices%rowtype;
  c_id uuid;
  editor_id uuid;
  item jsonb;
  product_row public.products%rowtype;
  seq integer := 0;
  sub numeric := 0;
  tax numeric;
  total numeric;
  discount numeric;
  collect_method text := p_payload->>'itemCollectMethod';
  pay_method text := p_payload->>'paymentMethod';
  payload_item_id uuid;
  saved_item_id uuid;
  removed_item_id uuid;
  keep_ids uuid[] := '{}'::uuid[];
begin
  select * into inv
  from public.invoices
  where id = p_id and deleted_at is null
  for update;
  if not found then raise exception 'Invoice not found'; end if;
  if jsonb_array_length(coalesce(p_payload->'items', '[]'::jsonb)) < 1 then
    raise exception 'At least one item is required';
  end if;
  if nullif(trim(p_payload#>>'{customer,name}'), '') is null then
    raise exception 'Customer company is required';
  end if;
  if nullif(trim(p_payload#>>'{customer,billingAddress}'), '') is null then
    raise exception 'Billing Address is required';
  end if;
  if collect_method is null or collect_method not in ('delivery', 'self_collect') then
    raise exception 'Please select an item collect method';
  end if;
  if pay_method is null or pay_method not in ('paynow', 'cash', 'terms') then
    raise exception 'Please select a payment method';
  end if;

  c_id := nullif(p_payload#>>'{customer,customerId}', '')::uuid;
  if c_id is not null and not exists(
    select 1 from public.customers where id = c_id and deleted_at is null
  ) then
    raise exception 'Selected customer was not found';
  end if;
  editor_id := nullif(p_payload->>'updatedByUserId', '')::uuid;

  for item in select * from jsonb_array_elements(p_payload->'items') loop
    select * into product_row
    from public.products
    where id = nullif(item->>'productId', '')::uuid
      and sku = item->>'sku'
      and deleted_at is null;
    if not found then raise exception 'Item %: Please select a valid SKU', seq + 1; end if;
    discount := coalesce((item->>'discount')::numeric, 0);
    if (item->>'quantity')::numeric <= 0
       or (item->>'unitPrice')::numeric < 0
       or discount < 0 then
      raise exception 'Item % has an invalid quantity, price, or discount', seq + 1;
    end if;
    sub := sub + round(
      (item->>'quantity')::numeric * (item->>'unitPrice')::numeric - discount,
      2
    );
    seq := seq + 1;
  end loop;
  if sub < 0 then raise exception 'Discount cannot exceed sales amount'; end if;
  tax := round(sub * coalesce((p_payload->>'gstRate')::numeric, inv.gst_rate) / 100, 2);
  total := sub + tax;

  update public.invoices
  set invoice_date = (p_payload->>'invoiceDate')::date,
      customer_id = c_id,
      customer_company_name = p_payload#>>'{customer,name}',
      customer_contact_person = p_payload#>>'{customer,attention}',
      customer_contact_number = p_payload#>>'{customer,phone}',
      billing_address = p_payload#>>'{customer,billingAddress}',
      delivery_address = p_payload#>>'{customer,deliveryAddress}',
      po_number = p_payload->>'poNumber',
      subtotal = sub,
      gst_rate = coalesce((p_payload->>'gstRate')::numeric, inv.gst_rate),
      gst_amount = tax,
      grand_total = total,
      deposit = coalesce((p_payload->>'deposit')::numeric, 0),
      balance = total - coalesce((p_payload->>'deposit')::numeric, 0),
      item_collect_method = collect_method,
      payment_method = pay_method,
      remarks = p_payload->>'remarks',
      status = coalesce(
        lower(replace(p_payload->>'paymentStatus', ' ', '_'))::invoice_status,
        inv.status
      ),
      updated_by_user_id = editor_id,
      updated_at = now()
  where id = p_id;

  seq := 0;
  for item in select * from jsonb_array_elements(p_payload->'items') loop
    seq := seq + 1;
    select * into product_row
    from public.products
    where id = (item->>'productId')::uuid
      and sku = item->>'sku'
      and deleted_at is null;
    payload_item_id := nullif(item->>'id', '')::uuid;
    saved_item_id := null;
    select id into saved_item_id
    from public.invoice_items
    where id = payload_item_id and invoice_id = p_id;

    if saved_item_id is null then
      insert into public.invoice_items(
        invoice_id, line_order, product_id, product_model, sku, product_type,
        description, brand, quantity, unit_price, unit_cost, discount_amount,
        remarks
      ) values (
        p_id, seq, product_row.id, product_row.product_model, product_row.sku,
        product_row.product_type, coalesce(item->>'description', ''),
        coalesce(item->>'brand', ''), (item->>'quantity')::numeric,
        (item->>'unitPrice')::numeric,
        coalesce((item->>'unitCost')::numeric, product_row.cost_price, 0),
        coalesce((item->>'discount')::numeric, 0), item->>'remarks'
      ) returning id into saved_item_id;
    else
      if exists (
        select 1
        from public.invoice_items as existing_item
        join public.delivery_order_items as delivery_item
          on delivery_item.invoice_item_id = existing_item.id
        where existing_item.id = saved_item_id
          and existing_item.product_id is distinct from product_row.id
      ) then
        raise exception 'An Invoice item referenced by Delivery Order history cannot change SKU';
      end if;
      update public.invoice_items
      set line_order = seq,
          product_id = product_row.id,
          product_model = product_row.product_model,
          sku = product_row.sku,
          product_type = product_row.product_type,
          description = coalesce(item->>'description', ''),
          brand = coalesce(item->>'brand', ''),
          quantity = (item->>'quantity')::numeric,
          unit_price = (item->>'unitPrice')::numeric,
          unit_cost = coalesce((item->>'unitCost')::numeric, product_row.cost_price, 0),
          discount_amount = coalesce((item->>'discount')::numeric, 0),
          remarks = item->>'remarks'
      where id = saved_item_id;
    end if;
    keep_ids := array_append(keep_ids, saved_item_id);
  end loop;

  for removed_item_id in
    select id from public.invoice_items
    where invoice_id = p_id and not (id = any(keep_ids))
  loop
    if exists (
      select 1 from public.delivery_order_items
      where invoice_item_id = removed_item_id
    ) then
      raise exception 'An Invoice item referenced by Delivery Order history cannot be removed';
    end if;
    delete from public.invoice_items where id = removed_item_id;
  end loop;

  perform public.validate_invoice_delivery_quantities(p_id);
  insert into public.audit_logs(user_id, action, entity_type, entity_id, new_values)
  values(editor_id, 'document_edited', 'invoice', p_id, p_payload);
end $$;

create or replace function public.update_delivery_order_document_v7(p_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_invoice_id uuid := nullif(p_payload->>'invoiceId', '')::uuid;
begin
  perform public.update_delivery_order_document_v5(p_id, p_payload);

  update public.delivery_order_items as delivery_item
  set invoice_item_id = case
    when v_invoice_id is null then null
    else nullif(payload_item.value->>'invoiceItemId', '')::uuid
  end
  from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb))
       with ordinality as payload_item(value, line_order)
  where delivery_item.delivery_order_id = p_id
    and delivery_item.line_order = payload_item.line_order;

  if v_invoice_id is not null then
    perform public.validate_invoice_delivery_quantities(v_invoice_id);
  end if;
end $$;

-- Deleting an Invoice now reverses every active linked Delivery Order rather
-- than only the first one. Cancelling one DO affects only that DO.
create or replace function public.soft_delete_document(p_type text, p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
  item_id uuid;
  linked_do uuid;
  linked_invoice_id uuid;
begin
  if p_type = 'delivery_order' then
    select invoice_id into linked_invoice_id
    from public.delivery_orders
    where id = p_id and deleted_at is null
    for update;
    if not found then raise exception 'Delivery order not found'; end if;
    if linked_invoice_id is not null then
      raise exception 'This Delivery Order is linked to an Invoice and cannot be deleted separately. Delete the related Invoice to remove this Delivery Order.';
    end if;
    for item_id in
      select id from public.delivery_order_items where delivery_order_id = p_id
    loop
      perform public.reverse_delivery_order_item_stock(
        item_id,
        'Delivery order deleted or cancelled'
      );
    end loop;
    update public.delivery_orders
    set deleted_at = now(), status = 'cancelled', updated_at = now()
    where id = p_id and deleted_at is null;
  elsif p_type = 'invoice' then
    perform 1 from public.invoices
    where id = p_id and deleted_at is null
    for update;
    if not found then raise exception 'Invoice not found'; end if;
    for linked_do in
      select id from public.delivery_orders
      where invoice_id = p_id and deleted_at is null
      for update
    loop
      for item_id in
        select id from public.delivery_order_items
        where delivery_order_id = linked_do
      loop
        perform public.reverse_delivery_order_item_stock(
          item_id,
          'Parent Invoice deleted'
        );
      end loop;
      update public.delivery_orders
      set deleted_at = now(), status = 'cancelled', updated_at = now()
      where id = linked_do and deleted_at is null;
      insert into public.audit_logs(
        user_id, action, entity_type, entity_id, new_values
      ) values (
        auth.uid(), 'document_deleted', 'delivery_order', linked_do,
        jsonb_build_object(
          'soft_deleted', true,
          'inventory_reversed', true,
          'deleted_with_parent_invoice', p_id
        )
      );
    end loop;
    update public.invoices
    set deleted_at = now(), status = 'void', updated_at = now()
    where id = p_id and deleted_at is null;
  else
    raise exception 'Unknown document type';
  end if;

  insert into public.audit_logs(user_id, action, entity_type, entity_id, new_values)
  values(
    auth.uid(), 'document_deleted', p_type, p_id,
    jsonb_build_object('soft_deleted', true, 'inventory_reversed', true)
  );
end $$;

revoke all on function public.validate_invoice_delivery_quantities(uuid) from public;
revoke all on function public.create_invoice_with_do_v7(jsonb) from public;
revoke all on function public.create_invoice_only_v7(jsonb) from public;
revoke all on function public.create_delivery_order_only_v7(jsonb) from public;
revoke all on function public.update_invoice_document_v7(uuid,jsonb) from public;
revoke all on function public.update_delivery_order_document_v7(uuid,jsonb) from public;

grant execute on function public.validate_invoice_delivery_quantities(uuid) to service_role;
grant execute on function public.create_invoice_with_do_v7(jsonb) to authenticated,service_role;
grant execute on function public.create_invoice_only_v7(jsonb) to authenticated,service_role;
grant execute on function public.create_delivery_order_only_v7(jsonb) to authenticated,service_role;
grant execute on function public.update_invoice_document_v7(uuid,jsonb) to authenticated,service_role;
grant execute on function public.update_delivery_order_document_v7(uuid,jsonb) to authenticated,service_role;
grant execute on function public.soft_delete_document(text,uuid) to authenticated,service_role;

notify pgrst, 'reload schema';
