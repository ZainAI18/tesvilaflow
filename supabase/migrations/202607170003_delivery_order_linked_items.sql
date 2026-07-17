-- Allow a Delivery Order linked to an Invoice to contain both Invoice items and
-- Product-database Extra Items. Only Invoice-linked rows count toward Invoice
-- delivery completion; both sources continue to use the existing inventory
-- trigger on delivery_order_items.

alter table public.delivery_order_items
  add column if not exists item_source text;

update public.delivery_order_items
set item_source = case when invoice_item_id is null then 'extra' else 'invoice' end
where item_source is null
   or item_source not in ('invoice', 'extra');

alter table public.delivery_order_items
  alter column item_source set default 'extra',
  alter column item_source set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'delivery_order_items_item_source_check'
      and conrelid = 'public.delivery_order_items'::regclass
  ) then
    alter table public.delivery_order_items
      add constraint delivery_order_items_item_source_check
      check (item_source in ('invoice', 'extra'));
  end if;
end $$;

create or replace function public.sync_delivery_order_item_source()
returns trigger language plpgsql set search_path=public as $$
begin
  new.item_source := case when new.invoice_item_id is null then 'extra' else 'invoice' end;
  return new;
end $$;

drop trigger if exists delivery_order_item_source_sync on public.delivery_order_items;
create trigger delivery_order_item_source_sync
before insert or update of invoice_item_id on public.delivery_order_items
for each row execute function public.sync_delivery_order_item_source();

create or replace function public.validate_invoice_delivery_quantities(p_invoice_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
  over_item record;
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
      and delivery_order.status <> 'cancelled'
      and delivery_item.invoice_item_id is not null
      and not exists (
        select 1 from public.invoice_items as invoice_item
        where invoice_item.id = delivery_item.invoice_item_id
          and invoice_item.invoice_id = p_invoice_id
      )
  ) then
    raise exception 'An Invoice-linked Delivery Order item does not belong to the selected Invoice';
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

create or replace function public.validate_delivery_order_item_sources(
  p_delivery_order_id uuid,
  p_invoice_id uuid
) returns void language plpgsql security definer set search_path=public as $$
begin
  if exists (
    select 1 from public.delivery_order_items
    where delivery_order_id = p_delivery_order_id
      and invoice_item_id is not null
    group by invoice_item_id having count(*) > 1
  ) then
    raise exception 'This Invoice item has already been added to the current Delivery Order.';
  end if;

  if exists (
    select 1 from public.delivery_order_items
    where delivery_order_id = p_delivery_order_id
      and invoice_item_id is null
      and product_id is not null
    group by product_id having count(*) > 1
  ) then
    raise exception 'This Extra Item has already been added to the current Delivery Order.';
  end if;

  if p_invoice_id is null and exists (
    select 1 from public.delivery_order_items
    where delivery_order_id = p_delivery_order_id
      and invoice_item_id is not null
  ) then
    raise exception 'An Invoice item requires a selected Invoice.';
  end if;

  if p_invoice_id is not null then
    perform public.validate_invoice_delivery_quantities(p_invoice_id);
  end if;
end $$;

create or replace function public.create_delivery_order_only_v9(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  result jsonb;
  delivery_order_id uuid;
  invoice_id uuid := nullif(p_payload->>'invoiceId', '')::uuid;
begin
  result := public.create_delivery_order_only_v8(p_payload);
  delivery_order_id := (result#>>'{deliveryOrder,id}')::uuid;
  perform public.validate_delivery_order_item_sources(delivery_order_id, invoice_id);
  return result;
end $$;

create or replace function public.update_delivery_order_document_v9(
  p_id uuid,
  p_payload jsonb
) returns void language plpgsql security definer set search_path=public as $$
declare
  invoice_id uuid;
begin
  perform public.update_delivery_order_document_v8(p_id, p_payload);
  select delivery_order.invoice_id into invoice_id
  from public.delivery_orders as delivery_order
  where delivery_order.id = p_id and delivery_order.deleted_at is null;
  perform public.validate_delivery_order_item_sources(p_id, invoice_id);
end $$;

revoke all on function public.sync_delivery_order_item_source() from public;
revoke all on function public.validate_delivery_order_item_sources(uuid,uuid) from public;
revoke all on function public.create_delivery_order_only_v9(jsonb) from public;
revoke all on function public.update_delivery_order_document_v9(uuid,jsonb) from public;

grant execute on function public.validate_invoice_delivery_quantities(uuid) to service_role;
grant execute on function public.validate_delivery_order_item_sources(uuid,uuid) to service_role;
grant execute on function public.create_delivery_order_only_v9(jsonb) to authenticated,service_role;
grant execute on function public.update_delivery_order_document_v9(uuid,jsonb) to authenticated,service_role;

notify pgrst, 'reload schema';
