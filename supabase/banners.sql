-- Motor Wallah — dynamic banners & ads
--
-- Run this once in Supabase → SQL Editor → New query → paste → Run. It is
-- idempotent, so re-running it after an update is safe.
--
-- What it creates
--   banners              one row per ad slot (home_top, franchise_banner,
--                        business_spotlight, sidebar) with its media, link,
--                        status and click count
--   track_banner_click() the counting function the public site calls
--   the "banners"        public Storage bucket that holds the uploaded media
--                        (images and 2 MB MP4s)
--
-- Who can do what
--   Anyone may read the rows (the public site needs them) and call
--   track_banner_click() to add one click. Only a staff member can change a
--   row or upload a file, through public.is_staff() from supabase/schema.sql —
--   run that file first if you have not already.
--
-- Storage note: the bucket is public so the image URL works in an <img> tag.
-- Uploads and deletes are still staff-only, and the bucket rejects anything
-- larger than 2 MB or outside the listed types.

create table if not exists public.banners (
  id         uuid        primary key default gen_random_uuid(),
  section    text        not null unique,
  title      text        not null default '',
  media_type text        not null default 'image' check (media_type in ('image', 'video')),
  image_url  text        not null default '',
  target_url text        not null default '',
  status     text        not null default 'Inactive' check (status in ('Active', 'Inactive')),
  clicks     integer     not null default 0,
  updated_at timestamptz not null default now()
);

-- The four slots the site knows about. Seeded inactive and empty, so the front
-- end keeps its own artwork until someone uploads and activates a banner.
insert into public.banners (section, title) values
  ('home_top',           'Homepage top banner'),
  ('franchise_banner',   'Franchise banner'),
  ('business_spotlight', 'Business spotlight'),
  ('sidebar',            'Sidebar ad')
on conflict (section) do nothing;

drop trigger if exists banners_touch on public.banners;
create trigger banners_touch before update on public.banners
  for each row execute function public.touch_updated_at();

alter table public.banners enable row level security;

-- Everyone reads the live banners; the site filters on status itself.
drop policy if exists "banners public read" on public.banners;
create policy "banners public read" on public.banners
  for select to anon, authenticated
  using (true);

-- Only staff edit them (same allow-list the rest of the control room uses).
drop policy if exists "banners staff write" on public.banners;
create policy "banners staff write" on public.banners
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

grant select on public.banners to anon, authenticated;
grant insert, update, delete on public.banners to authenticated;

-- ---------------------------------------------------------------------------
-- Click tracking
-- ---------------------------------------------------------------------------
-- Visitors cannot update the banner rows, so counting goes through this
-- function. SECURITY DEFINER lets it bump the counter without opening an UPDATE
-- policy — it only ever touches `clicks`, and only for an active banner.
create or replace function public.track_banner_click(p_section text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  total integer;
begin
  update public.banners
     set clicks = clicks + 1
   where section = p_section
     and status = 'Active'
  returning clicks into total;

  return coalesce(total, 0);
end;
$$;

grant execute on function public.track_banner_click(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage bucket for the uploaded media
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'banners',
  'banners',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
)
on conflict (id) do update
  set public             = true,
      file_size_limit    = 2097152,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read so the <img>/<video> URL works for every visitor.
drop policy if exists "banners media public read" on storage.objects;
create policy "banners media public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'banners');

-- Uploading, replacing and deleting is staff-only.
drop policy if exists "banners media staff write" on storage.objects;
create policy "banners media staff write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'banners' and public.is_staff());

drop policy if exists "banners media staff update" on storage.objects;
create policy "banners media staff update" on storage.objects
  for update to authenticated
  using (bucket_id = 'banners' and public.is_staff())
  with check (bucket_id = 'banners' and public.is_staff());

drop policy if exists "banners media staff delete" on storage.objects;
create policy "banners media staff delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'banners' and public.is_staff());
