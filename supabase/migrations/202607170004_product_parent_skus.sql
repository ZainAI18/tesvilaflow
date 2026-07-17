-- Optional Parent SKU relationships are for Invoice-to-Delivery matching only.
-- Every Child Product keeps its own independent opening/current/reserved stock.

alter table public.products
  add column if not exists parent_product_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_parent_product_id_fkey'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_parent_product_id_fkey
      foreign key (parent_product_id) references public.products(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'products_parent_not_self_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_parent_not_self_check
      check (parent_product_id is null or parent_product_id <> id);
  end if;
end $$;

create index if not exists products_parent_product_idx
  on public.products(parent_product_id)
  where parent_product_id is not null and deleted_at is null;

create or replace function public.validate_product_parent_sku()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.parent_product_id is null then return new; end if;

  if not exists (
    select 1 from public.products as parent
    where parent.id = new.parent_product_id
      and parent.deleted_at is null
      and parent.parent_product_id is null
  ) then
    raise exception 'Please select a valid top-level Parent SKU.';
  end if;

  if exists (
    select 1 from public.products as child
    where child.parent_product_id = new.id
      and child.deleted_at is null
  ) then
    raise exception 'A Parent SKU with Child SKUs cannot also be a Child SKU.';
  end if;

  return new;
end $$;

drop trigger if exists products_parent_sku_validation on public.products;
create trigger products_parent_sku_validation
before insert or update of parent_product_id on public.products
for each row execute function public.validate_product_parent_sku();

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
        select 1
        from public.invoice_items as invoice_item
        join public.products as delivered_product
          on delivered_product.id = delivery_item.product_id
         and delivered_product.deleted_at is null
        where invoice_item.id = delivery_item.invoice_item_id
          and invoice_item.invoice_id = p_invoice_id
          and (
            (
              delivered_product.id = invoice_item.product_id
              and not exists (
                select 1 from public.products as child
                where child.parent_product_id = invoice_item.product_id
                  and child.deleted_at is null
              )
            )
            or delivered_product.parent_product_id = invoice_item.product_id
          )
      )
  ) then
    raise exception 'A Delivery SKU must match the Invoice SKU or one of its Child SKUs.';
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
      and product_id is not null
    group by invoice_item_id, product_id having count(*) > 1
  ) then
    raise exception 'This Child SKU has already been added for the same Invoice item.';
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

revoke all on function public.validate_product_parent_sku() from public;
grant execute on function public.validate_invoice_delivery_quantities(uuid) to service_role;
grant execute on function public.validate_delivery_order_item_sources(uuid,uuid) to service_role;

notify pgrst, 'reload schema';
