-- Optional Delivery Order -> Invoice link and invoice-number snapshot.
-- The existing nullable invoice_id foreign key remains the authoritative link.

alter table public.delivery_orders
  add column if not exists invoice_number text;

update public.delivery_orders as delivery_order
set invoice_number = invoice.invoice_number
from public.invoices as invoice
where delivery_order.invoice_id = invoice.id
  and delivery_order.invoice_number is null;

create index if not exists delivery_orders_invoice_idx
  on public.delivery_orders(invoice_id)
  where invoice_id is not null;

create or replace function public.create_invoice_with_do_v5(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  result jsonb;
  v_invoice_id uuid;
  v_delivery_order_id uuid;
  v_invoice_number text;
begin
  result := public.create_invoice_with_do_v4(p_payload);
  v_invoice_id := (result#>>'{invoice,id}')::uuid;
  v_delivery_order_id := (result#>>'{deliveryOrder,id}')::uuid;
  v_invoice_number := result#>>'{invoice,invoiceNumber}';

  update public.delivery_orders
  set invoice_number = v_invoice_number,
      updated_at = now()
  where id = v_delivery_order_id
    and invoice_id = v_invoice_id;

  return result;
end $$;

create or replace function public.create_delivery_order_only_v5(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  result jsonb;
  v_delivery_order_id uuid;
  v_invoice_id uuid := nullif(p_payload->>'invoiceId', '')::uuid;
  v_invoice_number text;
begin
  if v_invoice_id is not null then
    select invoice.invoice_number
    into v_invoice_number
    from public.invoices as invoice
    where invoice.id = v_invoice_id
      and invoice.deleted_at is null;

    if not found then
      raise exception 'Selected Invoice was not found';
    end if;
  end if;

  result := public.create_delivery_order_only_v4(p_payload);
  v_delivery_order_id := (result#>>'{deliveryOrder,id}')::uuid;

  update public.delivery_orders
  set invoice_id = v_invoice_id,
      invoice_number = v_invoice_number,
      updated_at = now()
  where id = v_delivery_order_id;

  result := jsonb_set(
    result,
    '{deliveryOrder,invoiceId}',
    coalesce(to_jsonb(v_invoice_id), 'null'::jsonb),
    true
  );
  result := jsonb_set(
    result,
    '{deliveryOrder,invoiceNumber}',
    to_jsonb(coalesce(v_invoice_number, '—')),
    true
  );
  return result;
end $$;

create or replace function public.update_invoice_document_v5(p_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  perform public.update_invoice_document_v4(p_id, p_payload);

  update public.delivery_orders as delivery_order
  set invoice_number = invoice.invoice_number,
      updated_at = now()
  from public.invoices as invoice
  where delivery_order.invoice_id = p_id
    and invoice.id = p_id
    and delivery_order.deleted_at is null;
end $$;

create or replace function public.update_delivery_order_document_v5(p_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_invoice_id uuid := nullif(p_payload->>'invoiceId', '')::uuid;
  v_invoice_number text;
begin
  if v_invoice_id is not null then
    select invoice.invoice_number
    into v_invoice_number
    from public.invoices as invoice
    where invoice.id = v_invoice_id
      and invoice.deleted_at is null;

    if not found then
      raise exception 'Selected Invoice was not found';
    end if;
  end if;

  perform public.update_delivery_order_document_v4(p_id, p_payload);

  update public.delivery_orders
  set invoice_id = v_invoice_id,
      invoice_number = v_invoice_number,
      updated_at = now()
  where id = p_id;
end $$;

revoke all on function public.create_invoice_with_do_v5(jsonb) from public;
revoke all on function public.create_delivery_order_only_v5(jsonb) from public;
revoke all on function public.update_invoice_document_v5(uuid,jsonb) from public;
revoke all on function public.update_delivery_order_document_v5(uuid,jsonb) from public;

grant execute on function public.create_invoice_with_do_v5(jsonb) to authenticated,service_role;
grant execute on function public.create_delivery_order_only_v5(jsonb) to authenticated,service_role;
grant execute on function public.update_invoice_document_v5(uuid,jsonb) to authenticated,service_role;
grant execute on function public.update_delivery_order_document_v5(uuid,jsonb) to authenticated,service_role;

notify pgrst, 'reload schema';
