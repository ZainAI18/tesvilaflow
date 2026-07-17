-- Delivery Order Only uses the selected Invoice only as an item reference.
-- It intentionally does not enforce previous-delivery or remaining-quantity limits.

create or replace function public.validate_invoice_delivery_quantities(p_invoice_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  perform 1
  from public.invoices
  where id = p_invoice_id and deleted_at is null
  for update;
  if not found then raise exception 'Selected Invoice was not found'; end if;

  if exists (
    select 1
    from public.delivery_order_items as delivery_item
    join public.delivery_orders as delivery_order
      on delivery_order.id = delivery_item.delivery_order_id
    where delivery_order.invoice_id = p_invoice_id
      and delivery_order.deleted_at is null
      and delivery_item.invoice_item_id is not null
      and not exists (
        select 1
        from public.invoice_items as invoice_item
        join public.products as delivered_product
          on delivered_product.id = delivery_item.product_id
         and delivered_product.deleted_at is null
        where invoice_item.id = delivery_item.invoice_item_id
          and invoice_item.invoice_id = p_invoice_id
          and (
            delivered_product.id = invoice_item.product_id
            or delivered_product.parent_product_id = invoice_item.product_id
          )
      )
  ) then
    raise exception 'A Delivery SKU must match the selected Invoice item or one of its Child SKUs.';
  end if;
end $$;

revoke all on function public.validate_invoice_delivery_quantities(uuid) from public;
grant execute on function public.validate_invoice_delivery_quantities(uuid) to service_role;

notify pgrst, 'reload schema';
