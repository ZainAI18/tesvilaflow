-- Transactional Invoice hard deletion with database-enforced cascades.
-- Product.current_stock is stored, so a Delivery Order BEFORE DELETE trigger
-- restores each active outgoing movement to its saved physical stock owner.

alter table public.stock_movements
  add column if not exists delivery_order_id uuid,
  add column if not exists invoice_id uuid,
  add column if not exists reversed_at timestamptz,
  add column if not exists reversal_reason text;

-- A reversal row is dependent history of its original movement. Cascading this
-- self-reference allows a complete document movement set to be hard deleted
-- without leaving a reversal row pointing at a removed original movement.
alter table public.stock_movements
  drop constraint if exists stock_movements_reversal_of_fkey;
alter table public.stock_movements
  add constraint stock_movements_reversal_of_fkey
  foreign key(reversal_of) references public.stock_movements(id) on delete cascade;

-- Attach existing movements to their source documents using the strongest
-- available relationship first (saved Delivery Order item), then reference_id.
update public.stock_movements movement
set delivery_order_id = item.delivery_order_id
from public.delivery_order_items item
where movement.source_item_id = item.id
  and movement.delivery_order_id is null;

update public.stock_movements movement
set delivery_order_id = delivery_order.id
from public.delivery_orders delivery_order
where movement.delivery_order_id is null
  and movement.reference_type in ('delivery_order', 'delivery_order_reversal')
  and movement.reference_id = delivery_order.id;

update public.stock_movements movement
set invoice_id = delivery_order.invoice_id
from public.delivery_orders delivery_order
where movement.delivery_order_id = delivery_order.id
  and movement.invoice_id is null
  and delivery_order.invoice_id is not null;

-- Safely handle any legacy movement whose source item no longer exists before
-- the new foreign key is enabled. Active deductions are restored once.
do $$
declare movement record;
begin
  for movement in
    select stock_movement.id,
           coalesce(stock_movement.stock_product_id, stock_movement.product_id) as stock_id,
           stock_movement.quantity
    from public.stock_movements stock_movement
    where stock_movement.source_item_id is not null
      and not exists (
        select 1 from public.delivery_order_items item
        where item.id = stock_movement.source_item_id
      )
      and stock_movement.active
      and stock_movement.reversed_at is null
      and stock_movement.quantity < 0
    order by coalesce(stock_movement.stock_product_id, stock_movement.product_id),
             stock_movement.created_at,
             stock_movement.id
  loop
    update public.products
    set current_stock = current_stock + abs(movement.quantity), updated_at = now()
    where id = movement.stock_id;
    update public.stock_movements
    set active = false,
        reversed_at = now(),
        reversal_reason = 'Orphan cleanup before Invoice cascade migration'
    where id = movement.id and active and reversed_at is null;
  end loop;

  delete from public.stock_movements orphan_movement
  where orphan_movement.source_item_id is not null
    and not exists (
      select 1 from public.delivery_order_items item
      where item.id = orphan_movement.source_item_id
    );
end $$;

-- Recreate the structural relationships with explicit cascading rules.
alter table public.invoice_items
  drop constraint if exists invoice_items_invoice_id_fkey;
alter table public.invoice_items
  add constraint invoice_items_invoice_id_fkey
  foreign key(invoice_id) references public.invoices(id) on delete cascade;

alter table public.delivery_orders
  drop constraint if exists delivery_orders_invoice_id_fkey;
alter table public.delivery_orders
  add constraint delivery_orders_invoice_id_fkey
  foreign key(invoice_id) references public.invoices(id) on delete cascade;

alter table public.delivery_order_items
  drop constraint if exists delivery_order_items_delivery_order_id_fkey;
alter table public.delivery_order_items
  add constraint delivery_order_items_delivery_order_id_fkey
  foreign key(delivery_order_id) references public.delivery_orders(id) on delete cascade;

alter table public.delivery_order_items
  drop constraint if exists delivery_order_items_invoice_item_id_fkey;
alter table public.delivery_order_items
  add constraint delivery_order_items_invoice_item_id_fkey
  foreign key(invoice_item_id) references public.invoice_items(id) on delete cascade;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stock_movements_source_item_id_fkey'
      and conrelid = 'public.stock_movements'::regclass
  ) then
    alter table public.stock_movements
      add constraint stock_movements_source_item_id_fkey
      foreign key(source_item_id) references public.delivery_order_items(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'stock_movements_delivery_order_id_fkey'
      and conrelid = 'public.stock_movements'::regclass
  ) then
    alter table public.stock_movements
      add constraint stock_movements_delivery_order_id_fkey
      foreign key(delivery_order_id) references public.delivery_orders(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'stock_movements_invoice_id_fkey'
      and conrelid = 'public.stock_movements'::regclass
  ) then
    alter table public.stock_movements
      add constraint stock_movements_invoice_id_fkey
      foreign key(invoice_id) references public.invoices(id) on delete cascade;
  end if;
end $$;

create index if not exists stock_movements_delivery_order_idx
  on public.stock_movements(delivery_order_id);
create index if not exists stock_movements_invoice_idx
  on public.stock_movements(invoice_id);

create or replace function public.populate_stock_movement_document_links()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.delivery_order_id is null and new.source_item_id is not null then
    select item.delivery_order_id into new.delivery_order_id
    from public.delivery_order_items item
    where item.id = new.source_item_id;
  end if;

  if new.delivery_order_id is null
     and new.reference_type in ('delivery_order', 'delivery_order_reversal') then
    select delivery_order.id into new.delivery_order_id
    from public.delivery_orders delivery_order
    where delivery_order.id = new.reference_id;
  end if;

  if new.invoice_id is null and new.delivery_order_id is not null then
    select delivery_order.invoice_id into new.invoice_id
    from public.delivery_orders delivery_order
    where delivery_order.id = new.delivery_order_id;
  end if;
  return new;
end $$;

drop trigger if exists populate_stock_movement_document_links on public.stock_movements;
create trigger populate_stock_movement_document_links
before insert or update of source_item_id,reference_type,reference_id,delivery_order_id
on public.stock_movements
for each row execute function public.populate_stock_movement_document_links();

create or replace function public.restore_delivery_order_inventory_before_delete()
returns trigger language plpgsql security definer set search_path=public as $$
declare movement record; restored_count integer := 0;
begin
  for movement in
    select stock_movement.id,
           coalesce(stock_movement.stock_product_id, stock_movement.product_id) as stock_id,
           stock_movement.quantity
    from public.stock_movements stock_movement
    where (
        stock_movement.delivery_order_id = old.id
        or (
          stock_movement.reference_type in ('delivery_order', 'delivery_order_reversal')
          and stock_movement.reference_id = old.id
        )
        or stock_movement.source_item_id in (
          select item.id from public.delivery_order_items item
          where item.delivery_order_id = old.id
        )
      )
      and stock_movement.active
      and stock_movement.reversed_at is null
      and stock_movement.quantity < 0
    order by coalesce(stock_movement.stock_product_id, stock_movement.product_id),
             stock_movement.created_at,
             stock_movement.id
    for update
  loop
    update public.products
    set current_stock = current_stock + abs(movement.quantity), updated_at = now()
    where id = movement.stock_id;

    update public.stock_movements
    set active = false,
        reversed_at = now(),
        reversal_reason = 'Delivery Order hard deleted'
    where id = movement.id and active and reversed_at is null;
    restored_count := restored_count + 1;
  end loop;

  -- Remove every related movement, including inactive reversal history. The
  -- FK cascades are retained as a final structural guarantee.
  delete from public.stock_movements stock_movement
  where stock_movement.delivery_order_id = old.id
     or (
       stock_movement.reference_type in ('delivery_order', 'delivery_order_reversal')
       and stock_movement.reference_id = old.id
     )
     or stock_movement.source_item_id in (
       select item.id from public.delivery_order_items item
       where item.delivery_order_id = old.id
     );

  return old;
end $$;

drop trigger if exists restore_delivery_order_inventory_before_delete
on public.delivery_orders;
create trigger restore_delivery_order_inventory_before_delete
before delete on public.delivery_orders
for each row execute function public.restore_delivery_order_inventory_before_delete();

-- Restore and remove Invoice-linked movements before any of the Invoice's
-- multiple FK cascade paths begin. This makes cascade order irrelevant; the
-- subsequent Delivery Order triggers find no movement left to restore twice.
create or replace function public.restore_invoice_inventory_before_delete()
returns trigger language plpgsql security definer set search_path=public as $$
declare movement record;
begin
  for movement in
    select stock_movement.id,
           coalesce(stock_movement.stock_product_id, stock_movement.product_id) as stock_id,
           stock_movement.quantity
    from public.stock_movements stock_movement
    where (
        stock_movement.invoice_id = old.id
        or stock_movement.delivery_order_id in (
          select delivery_order.id from public.delivery_orders delivery_order
          where delivery_order.invoice_id = old.id
        )
        or stock_movement.source_item_id in (
          select item.id
          from public.delivery_order_items item
          join public.delivery_orders delivery_order
            on delivery_order.id = item.delivery_order_id
          where delivery_order.invoice_id = old.id
        )
      )
      and stock_movement.active
      and stock_movement.reversed_at is null
      and stock_movement.quantity < 0
    order by coalesce(stock_movement.stock_product_id, stock_movement.product_id),
             stock_movement.created_at,
             stock_movement.id
    for update
  loop
    update public.products
    set current_stock = current_stock + abs(movement.quantity), updated_at = now()
    where id = movement.stock_id;
    update public.stock_movements
    set active = false,
        reversed_at = now(),
        reversal_reason = 'Parent Invoice hard deleted'
    where id = movement.id and active and reversed_at is null;
  end loop;

  delete from public.stock_movements stock_movement
  where stock_movement.invoice_id = old.id
     or stock_movement.delivery_order_id in (
       select delivery_order.id from public.delivery_orders delivery_order
       where delivery_order.invoice_id = old.id
     )
     or stock_movement.source_item_id in (
       select item.id
       from public.delivery_order_items item
       join public.delivery_orders delivery_order
         on delivery_order.id = item.delivery_order_id
       where delivery_order.invoice_id = old.id
     );
  return old;
end $$;

drop trigger if exists restore_invoice_inventory_before_delete
on public.invoices;
create trigger restore_invoice_inventory_before_delete
before delete on public.invoices
for each row execute function public.restore_invoice_inventory_before_delete();

create or replace function public.delete_invoice_with_dependencies(
  p_invoice_id uuid,
  p_deleted_by uuid default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare invoice_row public.invoices%rowtype;
        delivery_order_count integer;
        delivery_item_count integer;
        movement_count integer;
begin
  select * into invoice_row
  from public.invoices
  where id = p_invoice_id
  for update;
  if not found then raise exception 'Invoice not found'; end if;

  select count(*) into delivery_order_count
  from public.delivery_orders where invoice_id = p_invoice_id;
  select count(*) into delivery_item_count
  from public.delivery_order_items item
  join public.delivery_orders delivery_order on delivery_order.id = item.delivery_order_id
  where delivery_order.invoice_id = p_invoice_id;
  select count(*) into movement_count
  from public.stock_movements movement
  where movement.invoice_id = p_invoice_id
     or movement.delivery_order_id in (
       select id from public.delivery_orders where invoice_id = p_invoice_id
     );

  delete from public.invoices where id = p_invoice_id;
  if not found then raise exception 'Invoice deletion failed'; end if;

  insert into public.audit_logs(user_id,action,entity_type,entity_id,old_values,new_values)
  values(
    coalesce(auth.uid(),p_deleted_by),'invoice_hard_deleted','invoice',p_invoice_id,
    jsonb_build_object('invoice_number',invoice_row.invoice_number),
    jsonb_build_object(
      'hard_deleted',true,
      'delivery_orders_deleted',delivery_order_count,
      'delivery_items_deleted',delivery_item_count,
      'stock_movements_deleted',movement_count,
      'inventory_restored',true
    )
  );

  return jsonb_build_object(
    'ok',true,
    'invoiceNumber',invoice_row.invoice_number,
    'deliveryOrdersDeleted',delivery_order_count,
    'deliveryItemsDeleted',delivery_item_count,
    'stockMovementsDeleted',movement_count
  );
end $$;

revoke all on function public.populate_stock_movement_document_links() from public;
revoke all on function public.restore_delivery_order_inventory_before_delete() from public;
revoke all on function public.restore_invoice_inventory_before_delete() from public;
revoke all on function public.delete_invoice_with_dependencies(uuid,uuid) from public;
grant execute on function public.delete_invoice_with_dependencies(uuid,uuid)
  to authenticated,service_role;

notify pgrst, 'reload schema';
