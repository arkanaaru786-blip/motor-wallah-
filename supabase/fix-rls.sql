-- ---------------------------------------------------------------------------
-- repair + verify the cloud schema
--
-- Run this whole file once in the Supabase SQL editor (it is safe to re-run).
-- It exists because inserts from the site were being rejected with
--   42501 new row violates row-level security policy
-- even though the policies in schema.sql looked correct. Rather than guess, this
-- script removes *every* policy on the five tables (including any left behind by
-- an earlier or partial run), recreates one known-good set, seeds the default
-- site settings, rebuilds the reporting views and then proves the insert path
-- works by impersonating a real signed-in user inside a transaction.
--
-- The last statement returns a one-row report. If it says "insert: ok" the site
-- can save to the cloud.
-- ---------------------------------------------------------------------------

-- 1. Drop every policy on the tables we own, whatever it is named.
do $$
declare p record;
begin
  for p in
    select policyname, schemaname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('app_records', 'profiles', 'leads', 'site_settings', 'staff')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- 2. RLS on, and one permissive policy per verb.
--
-- These are granted `to public` on purpose: the check itself is
-- `owner_id = auth.uid()`, which is false for anyone without a valid session,
-- so the policy does not need to name the `authenticated` role. That removes any
-- dependency on role naming, which is one of the ways this can silently break.
alter table public.app_records   enable row level security;
alter table public.profiles      enable row level security;
alter table public.leads         enable row level security;
alter table public.site_settings enable row level security;
alter table public.staff         enable row level security;

create policy "app_records owner" on public.app_records
  for all to public
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "app_records staff read" on public.app_records
  for select to public using (public.is_staff());

create policy "profiles owner" on public.profiles
  for all to public
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "profiles staff read" on public.profiles
  for select to public using (public.is_staff());

create policy "leads insert own" on public.leads
  for insert to public with check (owner_id = auth.uid());

create policy "leads read own" on public.leads
  for select to public using (owner_id = auth.uid());

create policy "leads staff read" on public.leads
  for select to public using (public.is_staff());

create policy "leads staff update" on public.leads
  for update to public
  using (public.is_staff())
  with check (public.is_staff());

create policy "site_settings public read" on public.site_settings
  for select to public using (true);

create policy "site_settings staff write" on public.site_settings
  for insert to public with check (public.is_staff());

create policy "site_settings staff update" on public.site_settings
  for update to public
  using (public.is_staff())
  with check (public.is_staff());

create policy "site_settings staff delete" on public.site_settings
  for delete to public using (public.is_staff());

create policy "staff read self" on public.staff
  for select to public using (user_id = auth.uid());

-- 3. Privileges (RLS decides rows, grants decide verbs).
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.app_records   to authenticated;
grant select, insert, update, delete on public.profiles      to authenticated;
grant select, insert, update         on public.leads         to authenticated;
grant select, insert, update, delete on public.site_settings to anon, authenticated;
grant select                         on public.staff         to authenticated;

-- 4. The default support numbers. Existing rows are never overwritten, so this
--    is safe after you have saved real values from the admin panel.
insert into public.site_settings (key, value) values
  ('phone_display',  '"1800 123 4567"'::jsonb),
  ('phone_href',     '"tel:18001234567"'::jsonb),
  ('whatsapp_base',  '"https://wa.me/919999999999"'::jsonb),
  ('support_email',  '""'::jsonb)
on conflict (key) do nothing;

-- 5. is_staff() must stay readable by the policies above.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

-- 6. Reporting views (the previous run never created them).
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

create or replace view public.orders
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

grant select on public.vehicles to authenticated;
grant select on public.orders   to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 7. Self-test: impersonate a signed-in user inside a transaction and insert a
--    row through RLS, then roll it back. This is the exact check the site was
--    failing, run on the server so the answer does not depend on the browser.
-- ---------------------------------------------------------------------------
drop table if exists _cloud_selftest;
create temp table _cloud_selftest (step text, result text);

do $$
declare
  test_uid uuid;
  test_uid2 uuid;
  original_role text := current_user;
  n int;
begin
  select id into test_uid from auth.users order by created_at limit 1;
  select id into test_uid2 from auth.users where id <> test_uid order by created_at limit 1;
  if test_uid is null then
    insert into _cloud_selftest values ('user', 'no users yet — open the site once, then re-run');
    return;
  end if;

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', test_uid, 'role', 'authenticated')::text,
      true
    );

    insert into public.app_records (owner_id, key, value)
    values (test_uid, '__selftest__', 'true'::jsonb)
    on conflict (owner_id, key) do update set value = excluded.value;

    select count(*) into n
    from public.app_records
    where owner_id = test_uid and key = '__selftest__';

    insert into _cloud_selftest values
      ('insert as signed-in user', case when n = 1 then 'ok' else 'row not visible' end);

    delete from public.app_records where key = '__selftest__';
    insert into _cloud_selftest values ('cleanup', 'ok');
  exception when others then
    insert into _cloud_selftest values ('insert as signed-in user', 'FAILED ' || sqlstate || ' ' || sqlerrm);
  end;

  -- Isolation: one signed-in visitor must never see another one's rows. Without
  -- this check a completely open table still reports "insert ok", because the
  -- insert path works fine when row level security is switched off.
  if test_uid2 is null then
    insert into _cloud_selftest values
      ('row isolation', 'needs two users — open the site in another browser, then re-run');
  else
    begin
      perform set_config('role', 'authenticated', true);
      perform set_config(
        'request.jwt.claims',
        json_build_object('sub', test_uid, 'role', 'authenticated')::text,
        true
      );
      insert into public.app_records (owner_id, key, value)
      values (test_uid, '__iso__', 'true'::jsonb)
      on conflict (owner_id, key) do update set value = excluded.value;

      perform set_config(
        'request.jwt.claims',
        json_build_object('sub', test_uid2, 'role', 'authenticated')::text,
        true
      );
      select count(*) into n from public.app_records where owner_id = test_uid;
      insert into _cloud_selftest values (
        'row isolation',
        case
          when n = 0 then 'ok — another user''s rows are hidden'
          else 'FAILED — ' || n || ' foreign row(s) visible; row level security is not enforced'
        end
      );

      perform set_config(
        'request.jwt.claims',
        json_build_object('sub', test_uid, 'role', 'authenticated')::text,
        true
      );
      delete from public.app_records where key = '__iso__' and owner_id = test_uid;
    exception when others then
      insert into _cloud_selftest values ('row isolation', 'FAILED ' || sqlstate || ' ' || sqlerrm);
    end;
  end if;

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', test_uid, 'role', 'authenticated')::text,
      true
    );
    insert into public.site_settings (key, value)
    values ('__selftest__', 'true'::jsonb)
    on conflict (key) do update set value = excluded.value;
    insert into _cloud_selftest values ('site_settings write as non-staff', 'allowed (expected: denied)');
    delete from public.site_settings where key = '__selftest__';
  exception when others then
    insert into _cloud_selftest values ('site_settings write as non-staff', 'correctly denied');
  end;

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', test_uid, 'role', 'authenticated')::text,
      true
    );
    select count(*) into n from public.site_settings where key = 'phone_display';
    insert into _cloud_selftest values
      ('site_settings readable by visitors', case when n = 1 then 'ok' else 'no rows visible' end);
  exception when others then
    insert into _cloud_selftest values ('site_settings readable by visitors', 'FAILED ' || sqlerrm);
  end;

  -- Hand the editor its own role back; the change above was transaction-local.
  perform set_config('role', original_role, true);
end $$;

select step, result
from _cloud_selftest
union all
select 'seeded settings', count(*)::text from public.site_settings
union all
select 'vehicles view', case when to_regclass('public.vehicles') is null then 'missing' else 'ok' end
union all
select
  'rls ' || c.relname,
  case when c.relrowsecurity then 'enabled' else 'DISABLED — every signed-in visitor can read every row' end
from pg_class c
join pg_namespace ns on ns.oid = c.relnamespace
where ns.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in ('app_records', 'profiles', 'leads', 'site_settings', 'staff')
order by 1;
