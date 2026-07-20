-- Persist the Invoice GST selection while keeping historical rows untouched.
-- Existing null rows are interpreted by the API from their saved GST totals.

alter table public.invoices
  add column if not exists gst_mode text;

alter table public.invoices
  alter column gst_mode set default 'gst_9';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.invoices'::regclass
      and conname = 'invoices_gst_mode_check'
  ) then
    alter table public.invoices
      add constraint invoices_gst_mode_check
      check (gst_mode is null or gst_mode in ('gst_9', 'included'));
  end if;
end $$;

create or replace function public.create_invoice_with_do_v11(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  mode text := coalesce(nullif(p_payload->>'gstMode', ''), 'gst_9');
  normalized_payload jsonb;
  result jsonb;
  invoice_id uuid;
begin
  if mode not in ('gst_9', 'included') then
    raise exception 'Please select a valid GST option.';
  end if;

  normalized_payload := jsonb_set(
    p_payload,
    '{gstRate}',
    to_jsonb(case when mode = 'gst_9' then 9 else 0 end),
    true
  );
  result := public.create_invoice_with_do_v10(normalized_payload);
  invoice_id := (result#>>'{invoice,id}')::uuid;

  update public.invoices
  set gst_mode = mode,
      updated_at = now()
  where id = invoice_id;

  return jsonb_set(result, '{invoice,gstMode}', to_jsonb(mode), true);
end $$;

create or replace function public.create_invoice_only_v9(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  mode text := coalesce(nullif(p_payload->>'gstMode', ''), 'gst_9');
  normalized_payload jsonb;
  result jsonb;
  invoice_id uuid;
begin
  if mode not in ('gst_9', 'included') then
    raise exception 'Please select a valid GST option.';
  end if;

  normalized_payload := jsonb_set(
    p_payload,
    '{gstRate}',
    to_jsonb(case when mode = 'gst_9' then 9 else 0 end),
    true
  );
  result := public.create_invoice_only_v8(normalized_payload);
  invoice_id := (result#>>'{invoice,id}')::uuid;

  update public.invoices
  set gst_mode = mode,
      updated_at = now()
  where id = invoice_id;

  return jsonb_set(result, '{invoice,gstMode}', to_jsonb(mode), true);
end $$;

create or replace function public.update_invoice_document_v9(
  p_id uuid,
  p_payload jsonb
) returns void language plpgsql security definer set search_path=public as $$
declare
  mode text := coalesce(nullif(p_payload->>'gstMode', ''), 'gst_9');
  normalized_payload jsonb;
begin
  if mode not in ('gst_9', 'included') then
    raise exception 'Please select a valid GST option.';
  end if;

  normalized_payload := jsonb_set(
    p_payload,
    '{gstRate}',
    to_jsonb(case when mode = 'gst_9' then 9 else 0 end),
    true
  );
  perform public.update_invoice_document_v8(p_id, normalized_payload);

  update public.invoices
  set gst_mode = mode,
      updated_at = now()
  where id = p_id
    and deleted_at is null;
end $$;

revoke all on function public.create_invoice_with_do_v11(jsonb) from public;
revoke all on function public.create_invoice_only_v9(jsonb) from public;
revoke all on function public.update_invoice_document_v9(uuid,jsonb) from public;

grant execute on function public.create_invoice_with_do_v11(jsonb) to authenticated,service_role;
grant execute on function public.create_invoice_only_v9(jsonb) to authenticated,service_role;
grant execute on function public.update_invoice_document_v9(uuid,jsonb) to authenticated,service_role;

notify pgrst, 'reload schema';
