-- Motor Wallah — Supabase schema
--
-- Run this once in the Supabase dashboard: Project → SQL Editor → New query →
-- paste → Run. It is idempotent, so re-running it after an update is safe.
--
-- What it creates
--   app_records   every JSON collection the app used to keep in localStorage
--   profiles      customer accounts (keyed by mobile number)
--   leads         one structured row per enquiry / intent (the capture log)
--   site_settings public site config: support phone, WhatsApp line, email
--   staff         who is allowed to read every table (the admin console)
--   vehicles      read-only view: SELL submissions as vehicle rows
--   orders        read-only view: decor / parts purchase intents
--
-- Identity model
--   Visitors are signed in anonymously by the app (supabase.auth
--   .signInAnonymously), so every browser is a real auth.users row. RLS then
--   scopes rows with auth.uid(), which means one visitor can never read another
--   visitor's shortlist, cart, chats or lead queue.
--
--   The admin console reads every row through `is_staff()`. To use it, create a
--   real (non-anonymous) Supabase Auth user for each staff member — Dashboard →
--   Authentication → Users → Add user — then add that user's id to `staff`
--   (there is a helper at the bottom of this file). Nothing is granted to
--   anonymous users beyond their own rows, so publishing the anon key is safe.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. app_records — the document store the app's stores read and write
-- ---------------------------------------------------------------------------
create table if not exists public.app_records (
  owner_id   uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  key        text        not null,
  value      jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, key)
);

create index if not exists app_records_key_idx on public.app_records (key);

-- ---------------------------------------------------------------------------
-- 2. profiles — customer accounts
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid        primary key default gen_random_uuid(),
  owner_id   uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  mobile     text        not null,
  name       text        not null,
  email      text        not null,
  city       text        not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, mobile)
);

-- ---------------------------------------------------------------------------
-- 3. leads — every enquiry, booking and intent the site captures
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id           uuid        primary key default gen_random_uuid(),
  owner_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  type         text        not null,
  source       text,
  vehicle_id   text,
  vehicle_name text,
  location     text,
  name         text,
  mobile       text,
  fields       jsonb       not null default '{}'::jsonb,
  payload      jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists leads_created_idx on public.leads (created_at desc);
create index if not exists leads_type_idx    on public.leads (type, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. site_settings — public read, staff write
-- ---------------------------------------------------------------------------
create table if not exists public.site_settings (
  key        text        primary key,
  value      jsonb       not null,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (key, value) values
  ('phone_display',  '"1800 123 4567"'::jsonb),
  ('phone_href',     '"tel:18001234567"'::jsonb),
  ('whatsapp_base',  '"https://wa.me/919999999999"'::jsonb),
  ('support_email',  '""'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 5. staff — the allow-list for the admin console
-- ---------------------------------------------------------------------------
create table if not exists public.staff (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  email      text,
  role       text        not null default 'staff',
  created_at timestamptz not null default now()
);

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_records_touch on public.app_records;
create trigger app_records_touch before update on public.app_records
  for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.app_records   enable row level security;
alter table public.profiles      enable row level security;
alter table public.leads         enable row level security;
alter table public.site_settings enable row level security;
alter table public.staff         enable row level security;

-- app_records: a visitor owns their row, staff may read everything.
drop policy if exists "app_records owner" on public.app_records;
create policy "app_records owner" on public.app_records
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "app_records staff read" on public.app_records;
create policy "app_records staff read" on public.app_records
  for select to authenticated
  using (public.is_staff());

-- profiles: same shape as app_records.
drop policy if exists "profiles owner" on public.profiles;
create policy "profiles owner" on public.profiles
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "profiles staff read" on public.profiles;
create policy "profiles staff read" on public.profiles
  for select to authenticated
  using (public.is_staff());

-- leads: a visitor may insert and read their own; only staff read all of them.
drop policy if exists "leads insert own" on public.leads;
create policy "leads insert own" on public.leads
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "leads read own" on public.leads;
create policy "leads read own" on public.leads
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "leads staff read" on public.leads;
create policy "leads staff read" on public.leads
  for select to authenticated
  using (public.is_staff());

drop policy if exists "leads staff update" on public.leads;
create policy "leads staff update" on public.leads
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- site_settings: the whole world reads the support numbers, staff edits them.
drop policy if exists "site_settings public read" on public.site_settings;
create policy "site_settings public read" on public.site_settings
  for select to anon, authenticated
  using (true);

drop policy if exists "site_settings staff write" on public.site_settings;
create policy "site_settings staff write" on public.site_settings
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- staff: a signed-in user can confirm their own row, nobody self-promotes.
drop policy if exists "staff read self" on public.staff;
create policy "staff read self" on public.staff
  for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Privileges (RLS decides which rows; grants decide which verbs)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.app_records   to authenticated;
grant select, insert, update, delete on public.profiles      to authenticated;
grant select, insert, update         on public.leads         to authenticated;
grant select, insert, update, delete on public.site_settings to anon, authenticated;
grant select                         on public.staff         to authenticated;

-- ---------------------------------------------------------------------------
-- Reporting views — the tables the brief asked for, without duplicating writes
-- ---------------------------------------------------------------------------
-- SELL submissions are leads of type sell_vehicle/sell_car, so the vehicle table
-- is a view over them rather than a second copy that could drift.
create or replace view public.vehicles
with (security_invoker = true)
as
select
  l.id,
  l.owner_id,
  coalesce(nullif(l.vehicle_name, ''), nullif(trim(
    coalesce(l.fields ->> 'brand', '') || ' ' || coalesce(l.fields ->> 'model', '')
  ), ''), 'Vehicle')                as title,
  l.fields ->> 'category'           as category,
  l.fields ->> 'year'               as year,
  coalesce(l.location, l.fields ->> 'city') as city,
  l.fields ->> 'expectedPrice'      as expected_price,
  l.fields,
  l.created_at
from public.leads l
where l.type in ('sell_vehicle', 'sell_car');

-- Decor / parts purchases used to be captured as decor_order and parts_enquiry
-- leads. Real orders now live in public.orders (see orders-helpdesk.sql), so this
-- export view is named legacy_orders to leave the table name free.
create or replace view public.legacy_orders
with (security_invoker = true)
as
select
  l.id,
  l.owner_id,
  l.type                            as order_type,
  l.name                            as customer_name,
  l.mobile                          as customer_mobile,
  l.fields ->> 'orderId'            as order_ref,
  l.fields ->> 'total'              as total,
  l.payload,
  l.created_at
from public.leads l
where l.type in ('decor_order', 'parts_enquiry');

grant select on public.vehicles      to authenticated;
grant select on public.legacy_orders to authenticated;

-- ---------------------------------------------------------------------------
-- Make yourself (or a teammate) staff
--   1. Dashboard → Authentication → Users → Add user (email + password).
--   2. Copy that user's UUID and run:
--        insert into public.staff (user_id, email, role)
--        values ('00000000-0000-0000-0000-000000000000', 'you@example.com', 'super_admin')
--        on conflict (user_id) do update set email = excluded.email, role = excluded.role;
--
-- One dashboard toggle is required for visitors to own rows at all:
--   Authentication → Providers → Anonymous sign-ins → Enable.
-- Without it the site keeps working from its on-device replica and simply does
-- not persist to the cloud (the app reports "offline" rather than erroring).
-- ---------------------------------------------------------------------------
