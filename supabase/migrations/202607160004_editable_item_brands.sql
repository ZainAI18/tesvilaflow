-- Preserve user-edited item brands as document snapshots while products remain
-- the master source used when an SKU is selected.

create or replace function public.create_invoice_with_do_v4(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  result jsonb;
  v_invoice_id uuid;
  v_delivery_order_id uuid;
begin
  result := public.create_invoice_with_do_v3(p_payload);
  v_invoice_id := (result#>>'{invoice,id}')::uuid;
  v_delivery_order_id := (result#>>'{deliveryOrder,id}')::uuid;

  update public.invoice_items as stored_item
  set brand = coalesce(payload_item.value->>'brand', '')
  from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb))
       with ordinality as payload_item(value, line_order)
  where stored_item.invoice_id = v_invoice_id
    and stored_item.line_order = payload_item.line_order;

  update public.delivery_order_items as stored_item
  set brand = coalesce(payload_item.value->>'brand', '')
  from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb))
       with ordinality as payload_item(value, line_order)
  where stored_item.delivery_order_id = v_delivery_order_id
    and stored_item.line_order = payload_item.line_order;

  return result;
end $$;

create or replace function public.create_delivery_order_only_v4(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  result jsonb;
  v_delivery_order_id uuid;
begin
  result := public.create_delivery_order_only_v3(p_payload);
  v_delivery_order_id := (result#>>'{deliveryOrder,id}')::uuid;

  update public.delivery_order_items as stored_item
  set brand = coalesce(payload_item.value->>'brand', '')
  from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb))
       with ordinality as payload_item(value, line_order)
  where stored_item.delivery_order_id = v_delivery_order_id
    and stored_item.line_order = payload_item.line_order;

  return result;
end $$;

create or replace function public.update_invoice_document_v4(p_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  perform public.update_invoice_document_v3(p_id, p_payload);

  update public.invoice_items as stored_item
  set brand = coalesce(payload_item.value->>'brand', '')
  from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb))
       with ordinality as payload_item(value, line_order)
  where stored_item.invoice_id = p_id
    and stored_item.line_order = payload_item.line_order;

  update public.delivery_order_items as stored_item
  set brand = coalesce(payload_item.value->>'brand', '')
  from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb))
       with ordinality as payload_item(value, line_order)
  where stored_item.delivery_order_id in (
      select delivery_order.id
      from public.delivery_orders as delivery_order
      where delivery_order.invoice_id = p_id
        and delivery_order.deleted_at is null
    )
    and stored_item.line_order = payload_item.line_order;
end $$;

create or replace function public.update_delivery_order_document_v4(p_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  perform public.update_delivery_order_document_v3(p_id, p_payload);

  update public.delivery_order_items as stored_item
  set brand = coalesce(payload_item.value->>'brand', '')
  from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb))
       with ordinality as payload_item(value, line_order)
  where stored_item.delivery_order_id = p_id
    and stored_item.line_order = payload_item.line_order;
end $$;

revoke all on function public.create_invoice_with_do_v4(jsonb) from public;
revoke all on function public.create_delivery_order_only_v4(jsonb) from public;
revoke all on function public.update_invoice_document_v4(uuid,jsonb) from public;
revoke all on function public.update_delivery_order_document_v4(uuid,jsonb) from public;

grant execute on function public.create_invoice_with_do_v4(jsonb) to authenticated,service_role;
grant execute on function public.create_delivery_order_only_v4(jsonb) to authenticated,service_role;
grant execute on function public.update_invoice_document_v4(uuid,jsonb) to authenticated,service_role;
grant execute on function public.update_delivery_order_document_v4(uuid,jsonb) to authenticated,service_role;

notify pgrst, 'reload schema';
