-- Motor Wallah — ad click leads
--
-- Run this once in Supabase → SQL Editor → New query → paste → Run, after
-- supabase/banners.sql. It is idempotent, so re-running it after an update is
-- safe.
--
-- What it creates
--   ad_leads    one row per visitor who clicked an advertisement and left their
--               name, mobile and requirement. The advertiser's contact details
--               are copied onto the row at capture time, so the lead still
--               reads correctly if the banner is later reassigned.
--   advertiser columns on public.banners (name, email, WhatsApp) — the control
--               room fills these in and the notification route uses them.
--
-- Who can do what
--   Anyone may INSERT an ad lead (the public site has no login at that point).
--   Nobody anonymous can read the table. Staff can read it and change a lead's
--   status through public.is_staff() from supabase/schema.sql.

alter table public.banners
  add column if not exists advertiser_name     text not null default '',
  add column if not exists advertiser_email    text not null default '',
  add column if not exists advertiser_whatsapp text not null default '';

create table if not exists public.ad_leads (
  id                  uuid        primary key default gen_random_uuid(),
  banner_section      text        not null,
  banner_title        text        not null default '',
  advertiser_name     text        not null default '',
  advertiser_email    text        not null default '',
  advertiser_whatsapp text        not null default '',
  name                text        not null,
  mobile              text        not null,
  requirement         text        not null default '',
  source_path         text        not null default '',
  status              text        not null default 'New'
                                  check (status in ('New', 'Contacted', 'Closed')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists ad_leads_created_at_idx on public.ad_leads (created_at desc);
create index if not exists ad_leads_section_idx on public.ad_leads (banner_section);

drop trigger if exists ad_leads_touch on public.ad_leads;
create trigger ad_leads_touch before update on public.ad_leads
  for each row execute function public.touch_updated_at();

alter table public.ad_leads enable row level security;

-- The public site captures the lead while the visitor is anonymous.
drop policy if exists "ad leads public insert" on public.ad_leads;
create policy "ad leads public insert" on public.ad_leads
  for insert to anon, authenticated
  with check (
    length(btrim(name)) between 2 and 120
    and length(btrim(mobile)) between 8 and 20
    and length(requirement) <= 1000
  );

-- Only staff read them or change their status.
drop policy if exists "ad leads staff read" on public.ad_leads;
create policy "ad leads staff read" on public.ad_leads
  for select to authenticated
  using (public.is_staff());

drop policy if exists "ad leads staff update" on public.ad_leads;
create policy "ad leads staff update" on public.ad_leads
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

grant insert on public.ad_leads to anon, authenticated;
grant select, update on public.ad_leads to authenticated;
