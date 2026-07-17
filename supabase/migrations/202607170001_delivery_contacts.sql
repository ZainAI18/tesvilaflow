-- Store delivery-site contacts independently from the Invoice/customer contact
-- snapshot. Historical Delivery Orders remain null and use a display-only
-- fallback in the application.

alter table public.delivery_orders
  add column if not exists delivery_contact_person text,
  add column if not exists delivery_contact_number text;

comment on column public.delivery_orders.delivery_contact_person is
  'Optional delivery-site contact saved for this Delivery Order only.';
comment on column public.delivery_orders.delivery_contact_number is
  'Optional delivery-site phone number saved for this Delivery Order only.';

create or replace function public.create_invoice_with_do_v8(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  result jsonb;
  delivery_order_id uuid;
  delivery_contact text := nullif(trim(p_payload->>'deliveryContact'), '');
  delivery_phone text := nullif(trim(p_payload->>'deliveryPhone'), '');
begin
  result := public.create_invoice_with_do_v7(p_payload);
  delivery_order_id := (result#>>'{deliveryOrder,id}')::uuid;

  update public.delivery_orders
  set delivery_contact_person = delivery_contact,
      delivery_contact_number = delivery_phone,
      updated_at = now()
  where id = delivery_order_id;

  result := jsonb_set(
    result,
    '{deliveryOrder,deliveryContact}',
    to_jsonb(coalesce(delivery_contact, '')),
    true
  );
  result := jsonb_set(
    result,
    '{deliveryOrder,deliveryPhone}',
    to_jsonb(coalesce(delivery_phone, '')),
    true
  );
  return result;
end $$;

create or replace function public.create_delivery_order_only_v8(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  result jsonb;
  delivery_order_id uuid;
  delivery_contact text := nullif(trim(p_payload->>'deliveryContact'), '');
  delivery_phone text := nullif(trim(p_payload->>'deliveryPhone'), '');
begin
  result := public.create_delivery_order_only_v7(p_payload);
  delivery_order_id := (result#>>'{deliveryOrder,id}')::uuid;

  update public.delivery_orders
  set delivery_contact_person = delivery_contact,
      delivery_contact_number = delivery_phone,
      updated_at = now()
  where id = delivery_order_id;

  result := jsonb_set(
    result,
    '{deliveryOrder,deliveryContact}',
    to_jsonb(coalesce(delivery_contact, '')),
    true
  );
  result := jsonb_set(
    result,
    '{deliveryOrder,deliveryPhone}',
    to_jsonb(coalesce(delivery_phone, '')),
    true
  );
  return result;
end $$;

create or replace function public.update_delivery_order_document_v8(
  p_id uuid,
  p_payload jsonb
) returns void language plpgsql security definer set search_path=public as $$
begin
  perform public.update_delivery_order_document_v7(p_id, p_payload);

  update public.delivery_orders
  set delivery_contact_person = nullif(trim(p_payload->>'deliveryContact'), ''),
      delivery_contact_number = nullif(trim(p_payload->>'deliveryPhone'), ''),
      updated_at = now()
  where id = p_id
    and deleted_at is null;
end $$;

revoke all on function public.create_invoice_with_do_v8(jsonb) from public;
revoke all on function public.create_delivery_order_only_v8(jsonb) from public;
revoke all on function public.update_delivery_order_document_v8(uuid,jsonb) from public;

grant execute on function public.create_invoice_with_do_v8(jsonb) to authenticated,service_role;
grant execute on function public.create_delivery_order_only_v8(jsonb) to authenticated,service_role;
grant execute on function public.update_delivery_order_document_v8(uuid,jsonb) to authenticated,service_role;

notify pgrst, 'reload schema';
