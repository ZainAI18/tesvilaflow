-- Add an atomic Invoice-only save path and guarantee that an Invoice can have
-- no more than one active Delivery Order. Invoice-only saves deliberately do
-- not insert delivery_order_items, so the existing stock trigger is not fired.

create unique index if not exists delivery_orders_one_active_invoice_unique
  on public.delivery_orders(invoice_id)
  where invoice_id is not null and deleted_at is null;

create or replace function public.create_invoice_only_v6(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  c_id uuid;
  issuer_id uuid;
  request_id uuid;
  inv_id uuid;
  inv_no text;
  item jsonb;
  product_row products%rowtype;
  seq integer := 0;
  sub numeric := 0;
  rate numeric;
  tax numeric;
  total numeric;
  dep numeric;
  discount numeric;
  collect_method text := p_payload->>'itemCollectMethod';
  pay_method text := p_payload->>'paymentMethod';
begin
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

  issuer_id := nullif(p_payload->>'issuedByUserId', '')::uuid;
  request_id := coalesce(
    nullif(p_payload->>'clientRequestId', '')::uuid,
    gen_random_uuid()
  );
  if exists(select 1 from public.invoices where client_request_id = request_id) then
    raise exception 'This invoice request was already saved';
  end if;

  inv_no := public.next_invoice_number();
  rate := coalesce((p_payload->>'gstRate')::numeric, 9);
  dep := coalesce((p_payload->>'deposit')::numeric, 0);

  for item in select * from jsonb_array_elements(p_payload->'items') loop
    select * into product_row
    from public.products
    where id = nullif(item->>'productId', '')::uuid
      and sku = item->>'sku'
      and deleted_at is null;
    if not found then
      raise exception 'Item %: Please select a valid SKU', seq + 1;
    end if;
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

  if sub < 0 then
    raise exception 'Discount cannot exceed sales amount';
  end if;
  tax := round(sub * rate / 100, 2);
  total := sub + tax;

  insert into public.invoices(
    invoice_number, invoice_date, customer_id, customer_company_name,
    customer_contact_person, customer_contact_number, billing_address,
    delivery_address, issued_by_user_id, issued_by_display_name,
    client_request_id, po_number, subtotal, gst_rate, gst_amount, grand_total,
    deposit, balance, item_collect_method, payment_method, remarks, status,
    created_by
  ) values (
    inv_no, (p_payload->>'invoiceDate')::date, c_id,
    p_payload#>>'{customer,name}', p_payload#>>'{customer,attention}',
    p_payload#>>'{customer,phone}', p_payload#>>'{customer,billingAddress}',
    p_payload#>>'{customer,deliveryAddress}', issuer_id,
    p_payload->>'issuedByDisplayName', request_id, p_payload->>'poNumber',
    sub, rate, tax, total, dep, total - dep, collect_method, pay_method,
    p_payload->>'remarks', 'issued', issuer_id
  ) returning id into inv_id;

  seq := 0;
  for item in select * from jsonb_array_elements(p_payload->'items') loop
    seq := seq + 1;
    select * into product_row
    from public.products
    where id = (item->>'productId')::uuid
      and sku = item->>'sku'
      and deleted_at is null;

    insert into public.invoice_items(
      invoice_id, line_order, product_id, product_model, sku, product_type,
      description, brand, quantity, unit_price, unit_cost, discount_amount,
      remarks
    ) values (
      inv_id, seq, product_row.id, product_row.product_model, product_row.sku,
      product_row.product_type, coalesce(item->>'description', ''),
      coalesce(item->>'brand', ''), (item->>'quantity')::numeric,
      (item->>'unitPrice')::numeric, product_row.cost_price,
      coalesce((item->>'discount')::numeric, 0), item->>'remarks'
    );
  end loop;

  insert into public.audit_logs(user_id, action, entity_type, entity_id, new_values)
  values (
    issuer_id, 'document_created', 'invoice', inv_id,
    jsonb_build_object('invoice_number', inv_no, 'save_mode', 'invoice_only')
  );

  return jsonb_build_object(
    'invoice', (p_payload - 'type') || jsonb_build_object(
      'id', inv_id,
      'invoiceNumber', inv_no,
      'doNumber', '—',
      'doId', '',
      'createdBy', p_payload->>'issuedByDisplayName',
      'issuedByUserId', issuer_id,
      'createdAt', now()
    )
  );
end $$;

create or replace function public.create_invoice_with_do_v6(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  return public.create_invoice_with_do_v5(p_payload);
end $$;

create or replace function public.create_delivery_order_only_v6(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_invoice_id uuid := nullif(p_payload->>'invoiceId', '')::uuid;
begin
  if v_invoice_id is not null and exists(
    select 1 from public.delivery_orders
    where invoice_id = v_invoice_id and deleted_at is null
  ) then
    raise exception 'This Invoice already has a linked Delivery Order.';
  end if;

  begin
    return public.create_delivery_order_only_v5(p_payload);
  exception when unique_violation then
    raise exception 'This Invoice already has a linked Delivery Order.';
  end;
end $$;

create or replace function public.update_invoice_document_v6(p_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  perform public.update_invoice_document_v5(p_id, p_payload);
end $$;

create or replace function public.update_delivery_order_document_v6(p_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_invoice_id uuid := nullif(p_payload->>'invoiceId', '')::uuid;
begin
  if v_invoice_id is not null and exists(
    select 1 from public.delivery_orders
    where invoice_id = v_invoice_id
      and id <> p_id
      and deleted_at is null
  ) then
    raise exception 'This Invoice already has a linked Delivery Order.';
  end if;

  begin
    perform public.update_delivery_order_document_v5(p_id, p_payload);
  exception when unique_violation then
    raise exception 'This Invoice already has a linked Delivery Order.';
  end;
end $$;

revoke all on function public.create_invoice_only_v6(jsonb) from public;
revoke all on function public.create_invoice_with_do_v6(jsonb) from public;
revoke all on function public.create_delivery_order_only_v6(jsonb) from public;
revoke all on function public.update_invoice_document_v6(uuid,jsonb) from public;
revoke all on function public.update_delivery_order_document_v6(uuid,jsonb) from public;

grant execute on function public.create_invoice_only_v6(jsonb) to authenticated,service_role;
grant execute on function public.create_invoice_with_do_v6(jsonb) to authenticated,service_role;
grant execute on function public.create_delivery_order_only_v6(jsonb) to authenticated,service_role;
grant execute on function public.update_invoice_document_v6(uuid,jsonb) to authenticated,service_role;
grant execute on function public.update_delivery_order_document_v6(uuid,jsonb) to authenticated,service_role;

notify pgrst, 'reload schema';
