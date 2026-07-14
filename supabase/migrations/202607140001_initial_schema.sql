-- Tesvila Pte Ltd operations schema. Run in Supabase SQL editor or via Supabase CLI.
create extension if not exists pgcrypto;
create type public.app_role as enum ('admin','sales','warehouse','accounts','viewer');
create type public.invoice_status as enum ('draft','issued','partially_paid','paid','overdue','void');
create type public.stock_movement_type as enum ('opening','incoming','outgoing','adjustment','damaged','returned','reserved','released','stock_take');

create table public.users (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null, email text not null unique, role public.app_role not null default 'viewer', active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.customers (
 id uuid primary key default gen_random_uuid(), customer_code text not null unique, company_name text not null,
 contact_person text, contact_number text, email text, billing_address text, delivery_address text, credit_terms text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.products (
 id uuid primary key default gen_random_uuid(), sku text not null unique, product_model text not null, product_type text not null,
 description text not null, brand text not null, cost_price numeric(14,2) not null default 0 check(cost_price>=0), selling_price numeric(14,2) not null default 0 check(selling_price>=0),
 opening_stock numeric(14,3) not null default 0, current_stock numeric(14,3) not null default 0, reserved_stock numeric(14,3) not null default 0 check(reserved_stock>=0), minimum_stock numeric(14,3) not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.document_sequences (
 sequence_key text primary key, last_value bigint not null default 0, sequence_date date, updated_at timestamptz not null default now()
);
create table public.invoices (
 id uuid primary key default gen_random_uuid(), invoice_number text not null unique, invoice_date date not null, customer_id uuid not null references public.customers(id),
 po_number text, subtotal numeric(14,2) not null check(subtotal>=0), gst_rate numeric(6,3) not null check(gst_rate>=0), gst_amount numeric(14,2) not null check(gst_amount>=0),
 grand_total numeric(14,2) not null check(grand_total>=0), deposit numeric(14,2) not null default 0 check(deposit>=0), balance numeric(14,2) not null,
 payment_method text, remarks text, status public.invoice_status not null default 'issued', source text not null default 'created' check(source in ('created','uploaded')),
 source_upload_id uuid, created_by uuid references public.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.invoice_items (
 id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.invoices(id) on delete cascade, line_order integer not null,
 product_id uuid references public.products(id), product_model text not null, sku text not null, product_type text not null, description text not null, brand text not null,
 quantity numeric(14,3) not null check(quantity>0), unit_price numeric(14,2) not null check(unit_price>=0), unit_cost numeric(14,2) not null default 0 check(unit_cost>=0),
 line_amount numeric(14,2) generated always as (round(quantity*unit_price,2)) stored, remarks text, unique(invoice_id,line_order)
);
create table public.delivery_orders (
 id uuid primary key default gen_random_uuid(), do_number text not null unique, delivery_date date not null, customer_id uuid not null references public.customers(id),
 invoice_id uuid references public.invoices(id), delivery_address text not null, contact_person text, contact_number text, remarks text,
 status text not null default 'draft' check(status in ('draft','scheduled','in_transit','delivered','cancelled')),
 inventory_processed_at timestamptz, source text not null default 'created' check(source in ('created','uploaded')),
 source_upload_id uuid, created_by uuid references public.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.delivery_order_items (
 id uuid primary key default gen_random_uuid(), delivery_order_id uuid not null references public.delivery_orders(id) on delete cascade, line_order integer not null,
 product_id uuid references public.products(id), product_model text not null, sku text not null, product_type text not null, description text not null, brand text not null,
 quantity numeric(14,3) not null check(quantity>0), unit_price numeric(14,2) not null default 0 check(unit_price>=0), remarks text, unique(delivery_order_id,line_order)
);
create table public.stock_movements (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id), movement_type public.stock_movement_type not null,
 quantity numeric(14,3) not null check(quantity<>0), balance_after numeric(14,3) not null, reference_type text, reference_id uuid, reference_number text,
 remarks text, created_by uuid references public.users(id), created_at timestamptz not null default now()
);
create table public.document_uploads (
 id uuid primary key default gen_random_uuid(), document_type text not null check(document_type in ('invoice','delivery_order')), storage_path text not null,
 original_filename text not null, mime_type text not null, extraction_status text not null default 'pending', extracted_data jsonb, confirmed_at timestamptz,
 processed_record_id uuid, uploaded_by uuid references public.users(id), created_at timestamptz not null default now()
);
alter table public.invoices add constraint invoices_source_upload_fk foreign key(source_upload_id) references public.document_uploads(id);
alter table public.delivery_orders add constraint delivery_orders_source_upload_fk foreign key(source_upload_id) references public.document_uploads(id);
create table public.company_settings (
 id boolean primary key default true check(id), legal_name text not null, uen text not null, address text not null, phone text, email text,
 gst_registered boolean not null default true, gst_rate numeric(6,3) not null default 9 check(gst_rate>=0), invoice_prefix text not null default 'TS-',
 invoice_terms text, do_terms text, logo_path text, paynow_qr_path text, updated_at timestamptz not null default now(), updated_by uuid references public.users(id)
);
create table public.audit_logs (
 id bigint generated always as identity primary key, user_id uuid references public.users(id), action text not null, entity_type text not null,
 entity_id uuid, old_values jsonb, new_values jsonb, ip_address inet, created_at timestamptz not null default now()
);
create index invoices_date_idx on public.invoices(invoice_date); create index invoices_customer_idx on public.invoices(customer_id);
create index invoice_items_product_idx on public.invoice_items(product_id); create index do_customer_idx on public.delivery_orders(customer_id);
create index stock_product_date_idx on public.stock_movements(product_id,created_at desc); create index audit_entity_idx on public.audit_logs(entity_type,entity_id);

-- Atomic invoice sequence with collision checking.
create or replace function public.next_invoice_number() returns text language plpgsql security definer set search_path=public as $$
declare n bigint; candidate text; prefix text;
begin
 select invoice_prefix into prefix from company_settings where id=true;
 insert into document_sequences(sequence_key,last_value) values('invoice',1384)
 on conflict(sequence_key) do update set last_value=document_sequences.last_value+1,updated_at=now() returning last_value into n;
 if n is null then n:=1384; end if;
 loop candidate:=coalesce(prefix,'TS-')||n; exit when not exists(select 1 from invoices where invoice_number=candidate); n:=n+1; update document_sequences set last_value=n where sequence_key='invoice'; end loop;
 return candidate;
end $$;

-- Atomic daily DO sequence; advisory lock protects the date bucket.
create or replace function public.next_do_number(p_date date default current_date) returns text language plpgsql security definer set search_path=public as $$
declare n bigint; candidate text; key text:='do:'||to_char(p_date,'YYYYMMDD');
begin
 perform pg_advisory_xact_lock(hashtext(key));
 insert into document_sequences(sequence_key,last_value,sequence_date) values(key,1,p_date)
 on conflict(sequence_key) do update set last_value=document_sequences.last_value+1,updated_at=now() returning last_value into n;
 if n is null then n:=1; end if;
 loop candidate:='DO'||to_char(p_date,'DDMMYYYY')||lpad(n::text,2,'0'); exit when not exists(select 1 from delivery_orders where do_number=candidate); n:=n+1; update document_sequences set last_value=n where sequence_key=key; end loop;
 return candidate;
end $$;

-- Exactly-once DO inventory posting. Row locks and unique DO number prevent double deduction.
create or replace function public.process_delivery_order_inventory(p_do_id uuid,p_user_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare d delivery_orders%rowtype; i delivery_order_items%rowtype; new_balance numeric;
begin
 select * into d from delivery_orders where id=p_do_id for update;
 if not found then raise exception 'Delivery order not found'; end if;
 if d.inventory_processed_at is not null then raise exception 'Delivery order % already processed',d.do_number; end if;
 for i in select * from delivery_order_items where delivery_order_id=p_do_id order by line_order loop
   update products set current_stock=current_stock-i.quantity,updated_at=now() where id=i.product_id and current_stock>=i.quantity returning current_stock into new_balance;
   if new_balance is null then raise exception 'Insufficient inventory for SKU %',i.sku; end if;
   insert into stock_movements(product_id,movement_type,quantity,balance_after,reference_type,reference_id,reference_number,created_by) values(i.product_id,'outgoing',-i.quantity,new_balance,'delivery_order',p_do_id,d.do_number,p_user_id);
 end loop;
 update delivery_orders set inventory_processed_at=now(),status='delivered',updated_at=now() where id=p_do_id;
 insert into audit_logs(user_id,action,entity_type,entity_id,new_values) values(p_user_id,'inventory_processed','delivery_order',p_do_id,jsonb_build_object('do_number',d.do_number));
end $$;

alter table users enable row level security; alter table customers enable row level security; alter table products enable row level security;
alter table invoices enable row level security; alter table invoice_items enable row level security; alter table delivery_orders enable row level security;
alter table delivery_order_items enable row level security; alter table stock_movements enable row level security; alter table document_uploads enable row level security;
alter table company_settings enable row level security; alter table audit_logs enable row level security;
create or replace function public.current_role() returns app_role language sql stable security definer set search_path=public as $$ select role from users where id=auth.uid() and active $$;
create policy "authenticated read customers" on customers for select to authenticated using(true);
create policy "sales manage customers" on customers for all to authenticated using(current_role() in ('admin','sales')) with check(current_role() in ('admin','sales'));
create policy "authenticated read products" on products for select to authenticated using(true);
create policy "warehouse manage products" on products for all to authenticated using(current_role() in ('admin','warehouse')) with check(current_role() in ('admin','warehouse'));
create policy "authenticated read invoices" on invoices for select to authenticated using(true);
create policy "sales accounts manage invoices" on invoices for all to authenticated using(current_role() in ('admin','sales','accounts')) with check(current_role() in ('admin','sales','accounts'));
create policy "authenticated read invoice items" on invoice_items for select to authenticated using(true);
create policy "sales accounts manage invoice items" on invoice_items for all to authenticated using(current_role() in ('admin','sales','accounts')) with check(current_role() in ('admin','sales','accounts'));
create policy "authenticated read dos" on delivery_orders for select to authenticated using(true);
create policy "sales warehouse manage dos" on delivery_orders for all to authenticated using(current_role() in ('admin','sales','warehouse')) with check(current_role() in ('admin','sales','warehouse'));
create policy "authenticated read do items" on delivery_order_items for select to authenticated using(true);
create policy "sales warehouse manage do items" on delivery_order_items for all to authenticated using(current_role() in ('admin','sales','warehouse')) with check(current_role() in ('admin','sales','warehouse'));
create policy "authenticated read movements" on stock_movements for select to authenticated using(true);
create policy "warehouse insert movements" on stock_movements for insert to authenticated with check(current_role() in ('admin','warehouse'));
create policy "own uploads" on document_uploads for all to authenticated using(uploaded_by=auth.uid() or current_role()='admin') with check(uploaded_by=auth.uid() or current_role()='admin');
create policy "authenticated read settings" on company_settings for select to authenticated using(true);
create policy "admin settings" on company_settings for all to authenticated using(current_role()='admin') with check(current_role()='admin');
create policy "admin audit" on audit_logs for select to authenticated using(current_role()='admin');

insert into company_settings(id,legal_name,uen,address,phone,email,gst_rate,invoice_prefix,invoice_terms,do_terms) values(true,'Tesvila Pte Ltd','202312345Z','18 Kaki Bukit Road 3, #04-12, Singapore 415978','+65 6748 3388','accounts@tesvila.com.sg',9,'TS-','Payment is due according to agreed credit terms. Pricing is confidential.','Inspect goods upon delivery. Report discrepancies within 24 hours.');

insert into customers(customer_code,company_name,contact_person,contact_number,email,billing_address,delivery_address,credit_terms) values
('CUS-001','Meridian Build Pte Ltd','Rachel Lim','+65 9123 4567','accounts@meridianbuild.sg','21 Woodlands Close, #06-18, Singapore 737854','21 Woodlands Close, #06-18, Singapore 737854','30 days'),
('CUS-002','Northstar Renovation','Jason Ong','+65 8772 1901','jason@northstar.sg','8 Ubi Road 2, Singapore 408538','8 Ubi Road 2, Singapore 408538','COD'),
('CUS-003','Atelier Habitat Pte Ltd','Mei Tan','+65 9231 0844','finance@atelierhabitat.sg','71 Robinson Road, Singapore 068895','71 Robinson Road, Singapore 068895','30 days'),
('CUS-004','Living Form Studio','Amir Rahman','+65 8114 7210','amir@livingform.sg','33 Joo Chiat Place, Singapore 427757','33 Joo Chiat Place, Singapore 427757','14 days');

insert into products(sku,product_model,product_type,description,brand,cost_price,selling_price,opening_stock,current_stock,reserved_stock,minimum_stock) values
('TV-WC-8801','Aurelia WC-8801','Water Closet','Rimless one-piece water closet','Tesvila',245,488,28,18,3,10),
('TV-BS-2210','Luna BS-2210','Basin','Counter-top ceramic basin','Tesvila',98,218,16,7,2,8),
('GR-FA-310','Eurosmart 310','Faucet','Single lever basin mixer','Grohe',165,329,34,25,4,10),
('TV-SH-908','Verde SH-908','Shower','Thermostatic rain shower set','Tesvila',288,568,13,12,1,6),
('KO-BT-442','Evok BT-442','Bathtub','Freestanding acrylic bathtub','Kohler',920,1680,5,3,1,3);
