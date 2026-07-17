-- Store the user-editable heading shown directly above the Invoice item table.
-- Historical documents receive the approved existing heading as their default.

alter table public.invoices
  add column if not exists invoice_title text;

update public.invoices
set invoice_title = 'Supply Sanitary Ware'
where invoice_title is null or trim(invoice_title) = '';

alter table public.invoices
  alter column invoice_title set default 'Supply Sanitary Ware',
  alter column invoice_title set not null;

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
