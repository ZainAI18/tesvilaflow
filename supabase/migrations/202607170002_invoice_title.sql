-- Store the user-editable heading shown directly above the Invoice item table.
-- Historical documents use the approved heading through the API/report fallback.

alter table public.invoices
  add column if not exists invoice_title text;

alter table public.invoices
  alter column invoice_title set default 'Supply Sanitary Ware';

-- Do not backfill historical rows with UPDATE here. Some older databases retain
-- legacy payment_method values under a NOT VALID check constraint; PostgreSQL
-- would re-check those unrelated values and reject the title backfill. The API
-- and report mapping display this same default whenever invoice_title is null.

comment on column public.invoices.invoice_title is
  'User-editable Invoice report item-section heading.';

create or replace function public.create_invoice_with_do_v9(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  result jsonb;
  invoice_id uuid;
  invoice_title_value text := coalesce(nullif(trim(p_payload->>'titleOfInvoice'), ''), 'Supply Sanitary Ware');
begin
  result := public.create_invoice_with_do_v8(p_payload);
  invoice_id := (result#>>'{invoice,id}')::uuid;

  update public.invoices
  set invoice_title = invoice_title_value,
      updated_at = now()
  where id = invoice_id;

  return jsonb_set(result, '{invoice,titleOfInvoice}', to_jsonb(invoice_title_value), true);
end $$;

create or replace function public.create_invoice_only_v8(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  result jsonb;
  invoice_id uuid;
  invoice_title_value text := coalesce(nullif(trim(p_payload->>'titleOfInvoice'), ''), 'Supply Sanitary Ware');
begin
  result := public.create_invoice_only_v7(p_payload);
  invoice_id := (result#>>'{invoice,id}')::uuid;

  update public.invoices
  set invoice_title = invoice_title_value,
      updated_at = now()
  where id = invoice_id;

  return jsonb_set(result, '{invoice,titleOfInvoice}', to_jsonb(invoice_title_value), true);
end $$;

create or replace function public.update_invoice_document_v8(p_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  perform public.update_invoice_document_v7(p_id, p_payload);

  update public.invoices
  set invoice_title = coalesce(nullif(trim(p_payload->>'titleOfInvoice'), ''), 'Supply Sanitary Ware'),
      updated_at = now()
  where id = p_id
    and deleted_at is null;
end $$;

revoke all on function public.create_invoice_with_do_v9(jsonb) from public;
revoke all on function public.create_invoice_only_v8(jsonb) from public;
revoke all on function public.update_invoice_document_v8(uuid,jsonb) from public;

grant execute on function public.create_invoice_with_do_v9(jsonb) to authenticated,service_role;
grant execute on function public.create_invoice_only_v8(jsonb) to authenticated,service_role;
grant execute on function public.update_invoice_document_v8(uuid,jsonb) to authenticated,service_role;

notify pgrst, 'reload schema';
