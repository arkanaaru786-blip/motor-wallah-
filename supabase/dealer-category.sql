-- ===========================================================================
-- Dealer portal — Phase 1: bind a dealer account to ONE vehicle category.
--
-- Run this once in Supabase → SQL Editor (it is idempotent).
--
-- Why a column and not a table of permissions: the dealer portal restricts
-- everything by a single value. A dealer who is assigned "Cars" cannot read,
-- list or edit Bikes, Trucks or any other category — not in the UI and not in
-- the data layer. One account therefore holds exactly one category, and the
-- only place it can be changed is the Master Admin panel.
--
-- Categories (must match src/lib/dealer-categories.ts):
--   cars, bikes, three-wheelers, scv, trucks, buses, tractors, taxi
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. staff.category — the dealer's category, null for ordinary staff
-- ---------------------------------------------------------------------------
alter table public.staff
  add column if not exists category text;

alter table public.staff
  add column if not exists dealer_status text not null default 'Active';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'staff_category_check'
  ) then
    alter table public.staff
      add constraint staff_category_check
      check (
        category is null
        or category in (
          'cars', 'bikes', 'three-wheelers', 'scv',
          'trucks', 'buses', 'tractors', 'taxi'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'staff_dealer_status_check'
  ) then
    alter table public.staff
      add constraint staff_dealer_status_check
      check (dealer_status in ('Active', 'Pending', 'Disabled'));
  end if;
end $$;

comment on column public.staff.category is
  'Vehicle category this dealer may trade in. NULL = ordinary staff, no dealer portal access.';

-- ---------------------------------------------------------------------------
-- 2. dealers — the showroom profile behind a dealer staff account
-- ---------------------------------------------------------------------------
create table if not exists public.dealers (
  user_id     uuid        primary key references auth.users (id) on delete cascade,
  dealer_code text        not null unique,
  name        text        not null,
  showroom    text        not null,
  email       text        not null,
  mobile      text        not null,
  city        text        not null,
  category    text        not null
    check (category in ('cars', 'bikes', 'three-wheelers', 'scv', 'trucks', 'buses', 'tractors', 'taxi')),
  status      text        not null default 'Pending'
    check (status in ('Active', 'Pending', 'Disabled')),
  created_at  timestamptz not null default now()
);

create index if not exists dealers_category_idx on public.dealers (category);
create index if not exists dealers_status_idx on public.dealers (status);

alter table public.dealers enable row level security;

-- A dealer reads only their own profile row.
drop policy if exists "dealers read own profile" on public.dealers;
create policy "dealers read own profile"
  on public.dealers for select
  using (user_id = auth.uid());

-- Staff (the admin console) may read every dealer.
drop policy if exists "staff read all dealers" on public.dealers;
create policy "staff read all dealers"
  on public.dealers for select
  using (public.is_staff());

-- Only staff create or change dealers; a dealer can never move themselves to
-- another category or approve themselves.
drop policy if exists "staff write dealers" on public.dealers;
create policy "staff write dealers"
  on public.dealers for all
  using (public.is_staff())
  with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- 3. Helper: the signed-in dealer's category (null when not a dealer)
-- ---------------------------------------------------------------------------
create or replace function public.dealer_category()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(d.category, s.category)
  from public.staff s
  left join public.dealers d on d.user_id = s.user_id
  where s.user_id = auth.uid()
    and coalesce(d.status, s.dealer_status) = 'Active'
$$;

comment on function public.dealer_category() is
  'The single vehicle category the signed-in dealer may trade in, or NULL.';

-- ---------------------------------------------------------------------------
-- 4. Self-check — prints what the migration actually did
-- ---------------------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'staff' and column_name = 'category')
    as staff_category_column,
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'dealers')
    as dealers_table,
  (select count(*) from public.dealers) as dealer_rows;
