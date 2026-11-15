-- Motor Wallah — careers, orders desk and vehicle approvals
--
-- Run once in Supabase → SQL Editor after supabase/schema.sql and
-- supabase/orders-helpdesk.sql. Idempotent.

-- ---------------------------------------------------------------------------
-- 1. Job vacancies (public careers page reads Active rows)
-- ---------------------------------------------------------------------------
create table if not exists public.job_vacancies (
  id              uuid        primary key default gen_random_uuid(),
  title           text        not null,
  department      text        not null default '',
  location        text        not null default 'Indore',
  description     text        not null default '',
  employment_type text        not null default 'Full-time',
  status          text        not null default 'Active' check (status in ('Active', 'Closed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists job_vacancies_touch on public.job_vacancies;
create trigger job_vacancies_touch before update on public.job_vacancies
  for each row execute function public.touch_updated_at();

alter table public.job_vacancies enable row level security;

drop policy if exists "job vacancies public read" on public.job_vacancies;
create policy "job vacancies public read" on public.job_vacancies
  for select to anon, authenticated
  using (status = 'Active');

drop policy if exists "job vacancies staff read" on public.job_vacancies;
create policy "job vacancies staff read" on public.job_vacancies
  for select to authenticated
  using (public.is_staff());

drop policy if exists "job vacancies staff write" on public.job_vacancies;
create policy "job vacancies staff write" on public.job_vacancies
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

grant select on public.job_vacancies to anon, authenticated;
grant insert, update, delete on public.job_vacancies to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Orders desk
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists payment_status text not null default 'paid';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_payment_status_check'
  ) then
    alter table public.orders
      add constraint orders_payment_status_check
      check (payment_status in ('paid', 'pending', 'refunded', 'failed'));
  end if;
end $$;

drop policy if exists "orders staff read" on public.orders;
create policy "orders staff read" on public.orders
  for select to authenticated
  using (public.is_staff());

drop policy if exists "orders staff update" on public.orders;
create policy "orders staff update" on public.orders
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "order items staff read" on public.order_items;
create policy "order items staff read" on public.order_items
  for select to authenticated
  using (public.is_staff());

drop policy if exists "shops staff read" on public.shops;
create policy "shops staff read" on public.shops
  for select to authenticated
  using (public.is_staff());

grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select on public.shops to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Vehicle approvals
-- ---------------------------------------------------------------------------
create table if not exists public.vehicle_approvals (
  id               uuid        primary key default gen_random_uuid(),
  dealer_id        text        not null,
  dealer_name      text        not null default '',
  category         text        not null,
  brand            text        not null,
  model            text        not null,
  vehicle_name     text        not null default '',
  year             integer     not null,
  price            numeric(12,2) not null check (price > 0),
  km               integer     not null default 0,
  fuel             text        not null default 'Petrol',
  city             text        not null default '',
  status           text        not null default 'Pending'
                               check (status in ('Pending', 'Approved', 'Rejected')),
  rejection_reason text        not null default '',
  created_at       timestamptz not null default now(),
  decided_at       timestamptz,
  updated_at       timestamptz not null default now()
);

create index if not exists vehicle_approvals_status_idx
  on public.vehicle_approvals (status, created_at desc);

drop trigger if exists vehicle_approvals_touch on public.vehicle_approvals;
create trigger vehicle_approvals_touch before update on public.vehicle_approvals
  for each row execute function public.touch_updated_at();

alter table public.vehicle_approvals enable row level security;

-- Dealers submit a new listing; it can only arrive as Pending.
drop policy if exists "vehicle approvals dealer insert" on public.vehicle_approvals;
create policy "vehicle approvals dealer insert" on public.vehicle_approvals
  for insert to anon, authenticated
  with check (
    status = 'Pending'
    and char_length(btrim(dealer_id)) between 1 and 80
    and char_length(btrim(brand)) between 1 and 80
    and char_length(btrim(model)) between 1 and 80
    and year between 1950 and 2100
    and price > 0
  );

-- The website may read approved listings only.
drop policy if exists "vehicle approvals public read" on public.vehicle_approvals;
create policy "vehicle approvals public read" on public.vehicle_approvals
  for select to anon, authenticated
  using (status = 'Approved');

drop policy if exists "vehicle approvals staff read" on public.vehicle_approvals;
create policy "vehicle approvals staff read" on public.vehicle_approvals
  for select to authenticated
  using (public.is_staff());

drop policy if exists "vehicle approvals staff update" on public.vehicle_approvals;
create policy "vehicle approvals staff update" on public.vehicle_approvals
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

grant insert on public.vehicle_approvals to anon, authenticated;
grant select, update on public.vehicle_approvals to authenticated;
