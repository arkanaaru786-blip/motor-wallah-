-- Motor Wallah — Phase 3A analytics, sessions and bot detection
-- Run once in Supabase SQL Editor. Idempotent and safe to re-run.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- visitor_sessions: one row per browser session/device visit context
-- ---------------------------------------------------------------------------
create table if not exists public.visitor_sessions (
  id               uuid        primary key default gen_random_uuid(),
  session_id       text        not null unique,
  owner_id         uuid        references auth.users (id) on delete set null,
  ip_address       text,
  city             text,
  device           text,
  browser          text,
  source           text,
  landing_path     text,
  user_agent       text,
  started_at       timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  page_views       integer     not null default 0,
  is_bounce        boolean     not null default true
);

create index if not exists visitor_sessions_started_idx on public.visitor_sessions (started_at desc);
create index if not exists visitor_sessions_source_idx  on public.visitor_sessions (source);

-- ---------------------------------------------------------------------------
-- visitor_events: custom funnel/events captured from the website
-- Supported event types include: page_view, car_view, buy_click, sell_click,
-- finance_submit, search_query, add_to_cart, category_view, vehicle_view,
-- form_submit, lead_captured, order_created.
-- ---------------------------------------------------------------------------
create table if not exists public.visitor_events (
  id           uuid        primary key default gen_random_uuid(),
  session_id   text,
  owner_id     uuid        references auth.users (id) on delete set null,
  event_type   text        not null,
  event_name   text,
  path         text,
  referrer     text,
  source       text,
  vehicle_id   text,
  vehicle_name text,
  category     text,
  query        text,
  value        numeric,
  metadata     jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists visitor_events_created_idx on public.visitor_events (created_at desc);
create index if not exists visitor_events_type_idx    on public.visitor_events (event_type, created_at desc);
create index if not exists visitor_events_session_idx on public.visitor_events (session_id, created_at desc);
create index if not exists visitor_events_vehicle_idx on public.visitor_events (vehicle_id);

-- ---------------------------------------------------------------------------
-- Leads: mark suspicious / bot submissions without breaking existing rows
-- ---------------------------------------------------------------------------
alter table public.leads add column if not exists is_suspicious boolean not null default false;
alter table public.leads add column if not exists suspicion_reason text;
alter table public.leads add column if not exists submit_duration_ms integer;
alter table public.leads add column if not exists recaptcha_token_present boolean not null default false;

create index if not exists leads_suspicious_idx on public.leads (is_suspicious, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- Visitors may only create/update their own analytics rows. Staff can read all.
-- ---------------------------------------------------------------------------
alter table public.visitor_sessions enable row level security;
alter table public.visitor_events   enable row level security;

drop policy if exists "visitor_sessions insert own" on public.visitor_sessions;
create policy "visitor_sessions insert own" on public.visitor_sessions
  for insert to authenticated
  with check (owner_id = auth.uid() or owner_id is null);

drop policy if exists "visitor_sessions update own" on public.visitor_sessions;
create policy "visitor_sessions update own" on public.visitor_sessions
  for update to authenticated
  using (owner_id = auth.uid() or owner_id is null)
  with check (owner_id = auth.uid() or owner_id is null);

drop policy if exists "visitor_sessions read own" on public.visitor_sessions;
create policy "visitor_sessions read own" on public.visitor_sessions
  for select to authenticated
  using (owner_id = auth.uid() or owner_id is null);

drop policy if exists "visitor_sessions staff read" on public.visitor_sessions;
create policy "visitor_sessions staff read" on public.visitor_sessions
  for select to authenticated
  using (public.is_staff());

drop policy if exists "visitor_events insert own" on public.visitor_events;
create policy "visitor_events insert own" on public.visitor_events
  for insert to authenticated
  with check (owner_id = auth.uid() or owner_id is null);

drop policy if exists "visitor_events read own" on public.visitor_events;
create policy "visitor_events read own" on public.visitor_events
  for select to authenticated
  using (owner_id = auth.uid() or owner_id is null);

drop policy if exists "visitor_events staff read" on public.visitor_events;
create policy "visitor_events staff read" on public.visitor_events
  for select to authenticated
  using (public.is_staff());

grant select, insert, update on public.visitor_sessions to authenticated;
grant select, insert         on public.visitor_events   to authenticated;
