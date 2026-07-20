-- Shared physical inventory for alternate/FOC selling SKUs.
-- This is intentionally separate from parent_product_id, which is used for
-- invoice-to-delivery fulfilment matching.

alter table public.products
  add column if not exists linked_stock_product_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_linked_stock_product_id_fkey'
  ) then
    alter table public.products
      add constraint products_linked_stock_product_id_fkey
      foreign key (linked_stock_product_id)
      references public.products(id)
      on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_linked_stock_not_self_check'
  ) then
    alter table public.products
      add constraint products_linked_stock_not_self_check
      check (linked_stock_product_id is null or linked_stock_product_id <> id);
  end if;
end $$;

create index if not exists products_linked_stock_product_idx
  on public.products(linked_stock_product_id)
  where linked_stock_product_id is not null;

create or replace function public.validate_linked_stock_product()
returns trigger language plpgsql set search_path=public as $$
declare target_link uuid;
begin
  if new.linked_stock_product_id is null then return new; end if;
  if new.linked_stock_product_id = new.id then
    raise exception 'A product cannot be linked to itself.';
  end if;

  select linked_stock_product_id into target_link
  from public.products
  where id = new.linked_stock_product_id and deleted_at is null;
  if not found then
    raise exception 'Linked Stock Product was not found or is inactive.';
  end if;
  if target_link is not null then
    raise exception 'Please select a main stock product that is not linked to another product.';
  end if;
  if exists (
    select 1 from public.products
    where linked_stock_product_id = new.id
      and deleted_at is null
      and id <> new.id
  ) then
    raise exception 'A main stock product used by linked products cannot itself be linked.';
  end if;
  return new;
end $$;

drop trigger if exists validate_product_linked_stock on public.products;
create trigger validate_product_linked_stock
before insert or update of linked_stock_product_id on public.products
for each row execute function public.validate_linked_stock_product();

create or replace function public.prevent_linked_stock_source_delete()
returns trigger language plpgsql set search_path=public as $$
declare child_count integer;
begin
  if old.deleted_at is null and new.deleted_at is not null then
    select count(*) into child_count
    from public.products
    where linked_stock_product_id = old.id and deleted_at is null;
    if child_count > 0 then
      raise exception 'This product is used as the stock source for % linked products. Remove or change those links before deleting it.', child_count;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists prevent_linked_stock_source_delete on public.products;
create trigger prevent_linked_stock_source_delete
before update of deleted_at on public.products
for each row execute function public.prevent_linked_stock_source_delete();

create or replace function public.resolve_stock_product_id(p_product_id uuid)
returns uuid language plpgsql stable security definer set search_path=public as $$
declare source_product public.products%rowtype; stock_product public.products%rowtype;
begin
  select * into source_product
  from public.products
  where id = p_product_id and deleted_at is null;
  if not found then raise exception 'Product not found'; end if;

  if source_product.linked_stock_product_id is null then
    return source_product.id;
  end if;

  select * into stock_product
  from public.products
  where id = source_product.linked_stock_product_id and deleted_at is null;
  if not found then raise exception 'Linked Stock Product was not found or is inactive.'; end if;
  if stock_product.linked_stock_product_id is not null then
    raise exception 'Please select a main stock product that is not linked to another product.';
  end if;
  return stock_product.id;
end $$;

alter table public.stock_movements
  add column if not exists source_product_id uuid,
  add column if not exists stock_product_id uuid,
  add column if not exists source_sku text,
  add column if not exists stock_sku text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='stock_movements_source_product_id_fkey') then
    alter table public.stock_movements add constraint stock_movements_source_product_id_fkey
      foreign key(source_product_id) references public.products(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='stock_movements_stock_product_id_fkey') then
    alter table public.stock_movements add constraint stock_movements_stock_product_id_fkey
      foreign key(stock_product_id) references public.products(id) on delete restrict;
  end if;
end $$;

update public.stock_movements m
set source_product_id = coalesce(m.source_product_id, m.product_id),
    stock_product_id = coalesce(m.stock_product_id, m.product_id),
    source_sku = coalesce(m.source_sku, p.sku),
    stock_sku = coalesce(m.stock_sku, p.sku)
from public.products p
where p.id = m.product_id
  and (m.source_product_id is null or m.stock_product_id is null
       or m.source_sku is null or m.stock_sku is null);

create index if not exists stock_movements_source_product_idx
  on public.stock_movements(source_product_id, created_at desc);
create index if not exists stock_movements_stock_product_idx
  on public.stock_movements(stock_product_id, created_at desc);

create or replace function public.apply_delivery_order_item_stock(p_item_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare i public.delivery_order_items%rowtype; d public.delivery_orders%rowtype;
        source_product public.products%rowtype; stock_product public.products%rowtype;
        stock_id uuid; before_qty numeric; after_qty numeric; movement_id uuid;
begin
  select * into i from delivery_order_items where id=p_item_id;
  if not found then raise exception 'Delivery order item not found'; end if;
  if i.product_id is null then raise exception 'SKU % is not linked to a product', i.sku; end if;
  select * into d from delivery_orders where id=i.delivery_order_id;
  if d.deleted_at is not null or d.status='cancelled' then return; end if;
  if exists(select 1 from stock_movements where source_item_id=i.id and active) then return; end if;

  select * into source_product from products where id=i.product_id and deleted_at is null;
  if not found then raise exception 'Product for SKU % was not found', i.sku; end if;
  stock_id := public.resolve_stock_product_id(source_product.id);
  select * into stock_product from products where id=stock_id for update;
  before_qty := stock_product.current_stock;
  if before_qty < i.quantity then
    raise exception 'Insufficient inventory for SKU % (stock source %, available %, requested %)',
      i.sku, stock_product.sku, before_qty, i.quantity;
  end if;
  after_qty := before_qty-i.quantity;
  update products set current_stock=after_qty,updated_at=now() where id=stock_id;
  insert into stock_movements(product_id,source_product_id,stock_product_id,source_sku,stock_sku,
    movement_type,quantity,balance_after,quantity_before,quantity_after,reference_type,
    reference_id,reference_number,source_item_id,remarks,created_by)
  values(stock_id,source_product.id,stock_id,source_product.sku,stock_product.sku,
    'outgoing',-i.quantity,after_qty,before_qty,after_qty,'delivery_order',
    d.id,d.do_number,i.id,'Automatic deduction from saved delivery order',auth.uid())
  returning id into movement_id;
end $$;

create or replace function public.reverse_delivery_order_item_stock(p_item_id uuid, p_reason text default 'Delivery order changed')
returns void language plpgsql security definer set search_path=public as $$
declare m public.stock_movements%rowtype; before_qty numeric; after_qty numeric; stock_id uuid;
begin
  select * into m from stock_movements
  where source_item_id=p_item_id and active order by created_at desc limit 1 for update;
  if not found then return; end if;
  stock_id := coalesce(m.stock_product_id,m.product_id);
  select current_stock into before_qty from products where id=stock_id for update;
  after_qty := before_qty + abs(m.quantity);
  update products set current_stock=after_qty,updated_at=now() where id=stock_id;
  update stock_movements set active=false where id=m.id;
  insert into stock_movements(product_id,source_product_id,stock_product_id,source_sku,stock_sku,
    movement_type,quantity,balance_after,quantity_before,quantity_after,reference_type,
    reference_id,reference_number,reversal_of,active,remarks,created_by)
  values(stock_id,coalesce(m.source_product_id,m.product_id),stock_id,m.source_sku,m.stock_sku,
    'returned',abs(m.quantity),after_qty,before_qty,after_qty,'delivery_order_reversal',
    m.reference_id,m.reference_number,m.id,false,p_reason,auth.uid());
end $$;

create or replace function public.record_stock_movement(
  p_product_id uuid, p_movement_type text, p_quantity numeric,
  p_reference_number text default null, p_remarks text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare source_product public.products%rowtype; stock_product public.products%rowtype;
        stock_id uuid; before_qty numeric; after_qty numeric; signed_qty numeric; movement_id uuid;
begin
  if p_movement_type not in ('incoming','damaged','returned') then
    raise exception 'Movement type must be incoming, damaged, or returned';
  end if;
  if p_quantity <= 0 then raise exception 'Quantity must be positive'; end if;
  select * into source_product from products where id=p_product_id and deleted_at is null;
  if not found then raise exception 'Product not found'; end if;
  stock_id := public.resolve_stock_product_id(source_product.id);
  select * into stock_product from products where id=stock_id and deleted_at is null for update;
  if not found then raise exception 'Stock product not found'; end if;
  before_qty := stock_product.current_stock;
  signed_qty := case when p_movement_type='damaged' then -p_quantity else p_quantity end;
  after_qty := before_qty+signed_qty;
  if after_qty < 0 then raise exception 'Insufficient stock'; end if;
  update products set current_stock=after_qty,updated_at=now() where id=stock_id;
  insert into stock_movements(product_id,source_product_id,stock_product_id,source_sku,stock_sku,
    movement_type,quantity,balance_after,quantity_before,quantity_after,reference_type,
    reference_number,remarks,created_by)
  values(stock_id,source_product.id,stock_id,source_product.sku,stock_product.sku,
    p_movement_type::stock_movement_type,signed_qty,after_qty,before_qty,after_qty,
    'manual',p_reference_number,p_remarks,auth.uid()) returning id into movement_id;
  return jsonb_build_object(
    'id',movement_id,'sourceProductId',source_product.id,'stockProductId',stock_id,
    'stockSku',stock_product.sku,'quantityBefore',before_qty,'quantityAfter',after_qty
  );
end $$;

-- Keep the older explicit processing function safe if it is called by an
-- integration. New saves are normally processed by the item trigger.
create or replace function public.process_delivery_order_inventory(p_do_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare d delivery_orders%rowtype; i delivery_order_items%rowtype;
        source_product products%rowtype; stock_product products%rowtype;
        stock_id uuid; before_qty numeric; new_balance numeric;
begin
  select * into d from delivery_orders where id=p_do_id for update;
  if not found then raise exception 'Delivery order not found'; end if;
  if d.inventory_processed_at is not null then raise exception 'Delivery order % already processed',d.do_number; end if;
  for i in select * from delivery_order_items where delivery_order_id=p_do_id order by line_order loop
    if exists(select 1 from stock_movements where source_item_id=i.id and active) then continue; end if;
    select * into source_product from products where id=i.product_id and deleted_at is null;
    stock_id := public.resolve_stock_product_id(i.product_id);
    select * into stock_product from products where id=stock_id for update;
    before_qty := stock_product.current_stock;
    if before_qty < i.quantity then raise exception 'Insufficient inventory for SKU %',i.sku; end if;
    new_balance := before_qty-i.quantity;
    update products set current_stock=new_balance,updated_at=now() where id=stock_id;
    insert into stock_movements(product_id,source_product_id,stock_product_id,source_sku,stock_sku,
      movement_type,quantity,balance_after,quantity_before,quantity_after,reference_type,
      reference_id,reference_number,source_item_id,created_by)
    values(stock_id,source_product.id,stock_id,source_product.sku,stock_product.sku,
      'outgoing',-i.quantity,new_balance,before_qty,new_balance,'delivery_order',
      p_do_id,d.do_number,i.id,p_user_id);
  end loop;
  update delivery_orders set inventory_processed_at=now(),status='delivered',updated_at=now() where id=p_do_id;
  insert into audit_logs(user_id,action,entity_type,entity_id,new_values)
  values(p_user_id,'inventory_processed','delivery_order',p_do_id,jsonb_build_object('do_number',d.do_number));
end $$;

revoke all on function public.resolve_stock_product_id(uuid) from public;
revoke all on function public.validate_linked_stock_product() from public;
revoke all on function public.prevent_linked_stock_source_delete() from public;
revoke all on function public.apply_delivery_order_item_stock(uuid) from public;
revoke all on function public.reverse_delivery_order_item_stock(uuid,text) from public;
revoke all on function public.record_stock_movement(uuid,text,numeric,text,text) from public;
revoke all on function public.process_delivery_order_inventory(uuid,uuid) from public;
grant execute on function public.resolve_stock_product_id(uuid) to authenticated,service_role;
grant execute on function public.apply_delivery_order_item_stock(uuid) to service_role;
grant execute on function public.reverse_delivery_order_item_stock(uuid,text) to service_role;
grant execute on function public.record_stock_movement(uuid,text,numeric,text,text) to authenticated,service_role;
grant execute on function public.process_delivery_order_inventory(uuid,uuid) to service_role;
