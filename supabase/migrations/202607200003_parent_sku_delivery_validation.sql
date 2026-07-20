-- Parent SKUs are commercial Invoice groupings and must never become physical
-- Delivery Order items. Child products remain linked through the existing
-- invoice_item_id + product_id snapshot fields and use the existing stock-owner
-- resolution for inventory movements.

create or replace function public.assert_payload_has_no_parent_skus(
  p_payload jsonb,
  p_context text
) returns void language plpgsql security definer set search_path=public as $$
declare
  parent_item record;
begin
  select payload_item.ordinality as line_number, product.sku
  into parent_item
  from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb))
       with ordinality as payload_item(value, ordinality)
  join public.products as product
    on product.id = nullif(payload_item.value->>'productId', '')::uuid
   and product.deleted_at is null
  where exists (
    select 1
    from public.products as child
    where child.parent_product_id = product.id
      and child.deleted_at is null
  )
  limit 1;

  if found then
    if p_context = 'invoice_with_do' then
      raise exception 'Item % — % is a Parent SKU and cannot be used to create a Delivery Order. Parent SKUs can only be saved using Save Invoice Only. Create the Delivery Order later and select the related Child SKU.',
        parent_item.line_number, parent_item.sku;
    end if;
    raise exception 'Item % — % is a Parent SKU and cannot be used in a Delivery Order. Select a valid Child SKU or normal Product SKU.',
      parent_item.line_number, parent_item.sku;
  end if;
end $$;

create or replace function public.create_invoice_with_do_v10(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  perform public.assert_payload_has_no_parent_skus(p_payload, 'invoice_with_do');
  return public.create_invoice_with_do_v9(p_payload);
end $$;

create or replace function public.create_delivery_order_only_v10(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  perform public.assert_payload_has_no_parent_skus(p_payload, 'delivery_order');
  return public.create_delivery_order_only_v9(p_payload);
end $$;

create or replace function public.update_delivery_order_document_v10(
  p_id uuid,
  p_payload jsonb
) returns void language plpgsql security definer set search_path=public as $$
begin
  perform public.assert_payload_has_no_parent_skus(p_payload, 'delivery_order');
  perform public.update_delivery_order_document_v9(p_id, p_payload);
end $$;

revoke all on function public.assert_payload_has_no_parent_skus(jsonb,text) from public;
revoke all on function public.create_invoice_with_do_v10(jsonb) from public;
revoke all on function public.create_delivery_order_only_v10(jsonb) from public;
revoke all on function public.update_delivery_order_document_v10(uuid,jsonb) from public;

grant execute on function public.assert_payload_has_no_parent_skus(jsonb,text) to service_role;
grant execute on function public.create_invoice_with_do_v10(jsonb) to authenticated,service_role;
grant execute on function public.create_delivery_order_only_v10(jsonb) to authenticated,service_role;
grant execute on function public.update_delivery_order_document_v10(uuid,jsonb) to authenticated,service_role;

notify pgrst, 'reload schema';
