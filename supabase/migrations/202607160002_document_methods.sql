-- Compact document-method dropdown persistence. Historical rows remain nullable.

alter table public.invoices
  add column if not exists item_collect_method text;

alter table public.delivery_orders
  add column if not exists item_collect_method text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoices_item_collect_method_check'
      and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
      add constraint invoices_item_collect_method_check
      check (item_collect_method is null or item_collect_method in ('delivery','self_collect'))
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'delivery_orders_item_collect_method_check'
      and conrelid = 'public.delivery_orders'::regclass
  ) then
    alter table public.delivery_orders
      add constraint delivery_orders_item_collect_method_check
      check (item_collect_method is null or item_collect_method in ('delivery','self_collect'))
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'invoices_payment_method_dropdown_check'
      and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
      add constraint invoices_payment_method_dropdown_check
      check (payment_method is null or payment_method in ('paynow','cash','terms'))
      not valid;
  end if;
end $$;

create or replace function public.create_invoice_with_do_v2(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  result jsonb;
  collect_method text := p_payload->>'itemCollectMethod';
  pay_method text := p_payload->>'paymentMethod';
  invoice_id uuid;
  delivery_order_id uuid;
begin
  if collect_method is null or collect_method not in ('delivery','self_collect') then
    raise exception 'Please select an item collect method';
  end if;
  if pay_method is null or pay_method not in ('paynow','cash','terms') then
    raise exception 'Please select a payment method';
  end if;

  result := public.create_invoice_with_do(p_payload);
  invoice_id := (result#>>'{invoice,id}')::uuid;
  delivery_order_id := (result#>>'{deliveryOrder,id}')::uuid;

  update public.invoices
  set item_collect_method = collect_method,
      payment_method = pay_method,
      updated_at = now()
  where id = invoice_id;

  update public.delivery_orders
  set item_collect_method = collect_method,
      updated_at = now()
  where id = delivery_order_id;

  result := jsonb_set(result, '{invoice,itemCollectMethod}', to_jsonb(collect_method), true);
  result := jsonb_set(result, '{invoice,paymentMethod}', to_jsonb(pay_method), true);
  result := jsonb_set(result, '{deliveryOrder,itemCollectMethod}', to_jsonb(collect_method), true);
  return result;
end $$;

create or replace function public.create_delivery_order_only_v2(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  result jsonb;
  collect_method text := p_payload->>'itemCollectMethod';
  delivery_order_id uuid;
begin
  if collect_method is null or collect_method not in ('delivery','self_collect') then
    raise exception 'Please select an item collect method';
  end if;

  result := public.create_delivery_order_only(p_payload);
  delivery_order_id := (result#>>'{deliveryOrder,id}')::uuid;

  update public.delivery_orders
  set item_collect_method = collect_method,
      updated_at = now()
  where id = delivery_order_id;

  result := jsonb_set(result, '{deliveryOrder,itemCollectMethod}', to_jsonb(collect_method), true);
  return result;
end $$;

create or replace function public.update_invoice_document_v2(p_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare
  collect_method text := p_payload->>'itemCollectMethod';
  pay_method text := p_payload->>'paymentMethod';
begin
  if collect_method is null or collect_method not in ('delivery','self_collect') then
    raise exception 'Please select an item collect method';
  end if;
  if pay_method is null or pay_method not in ('paynow','cash','terms') then
    raise exception 'Please select a payment method';
  end if;

  perform public.update_invoice_document(p_id, p_payload);

  update public.invoices
  set item_collect_method = collect_method,
      payment_method = pay_method,
      updated_at = now()
  where id = p_id;

  update public.delivery_orders
  set item_collect_method = collect_method,
      updated_at = now()
  where invoice_id = p_id and deleted_at is null;
end $$;

create or replace function public.update_delivery_order_document_v2(p_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare
  collect_method text := p_payload->>'itemCollectMethod';
begin
  if collect_method is null or collect_method not in ('delivery','self_collect') then
    raise exception 'Please select an item collect method';
  end if;

  perform public.update_delivery_order_document(p_id, p_payload);

  update public.delivery_orders
  set item_collect_method = collect_method,
      updated_at = now()
  where id = p_id;
end $$;

revoke all on function public.create_invoice_with_do_v2(jsonb) from public;
revoke all on function public.create_delivery_order_only_v2(jsonb) from public;
revoke all on function public.update_invoice_document_v2(uuid,jsonb) from public;
revoke all on function public.update_delivery_order_document_v2(uuid,jsonb) from public;

grant execute on function public.create_invoice_with_do_v2(jsonb) to authenticated,service_role;
grant execute on function public.create_delivery_order_only_v2(jsonb) to authenticated,service_role;
grant execute on function public.update_invoice_document_v2(uuid,jsonb) to authenticated,service_role;
grant execute on function public.update_delivery_order_document_v2(uuid,jsonb) to authenticated,service_role;

notify pgrst, 'reload schema';
