-- ===========================================================================
--  Motor Wallah — orders, order items and the help desk (Parts & Decor)
-- ===========================================================================
--  Run this once in Supabase → SQL Editor → New query → Run.
--  It is idempotent: re-running is safe.
--
--  What it creates
--    public.shops              one row per parts / decor shop, owned by a user
--    public.orders             one row per order, scoped to a customer + shop
--    public.order_items        line items, cascade-deleted with the order
--    public.help_desk_tickets  wrong / damaged / missing item reports
--
--  What it adds on top
--    place_order(...)          atomic order + items insert, server-side total
--    report_order_issue(...)   help desk ticket, ownership checked in SQL
--    RLS                       customer sees own orders, shop sees its orders
--
--  IMPORTANT — the `orders` name is already taken by a reporting view
--  (`create or replace view public.orders` in schema.sql, over the leads table).
--  This script drops that view and recreates it under the name
--  `legacy_orders`, so old lead-based order exports keep working. schema.sql and
--  fix-rls.sql have been updated to match.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 0. Retire the old reporting view, keep it queryable under a new name
-- ---------------------------------------------------------------------------
drop view if exists public.orders;

-- The export view needs `leads`, which schema.sql creates. Guarded so this
-- script can also run first (on a fresh project) without erroring.
do $do$
begin
  if to_regclass('public.leads') is null then
    raise notice 'public.leads missing — skipping the legacy_orders view (run schema.sql, then this file again)';
    return;
  end if;

  execute $view$
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
    where l.type in ('decor_order', 'parts_enquiry')
  $view$;
end;
$do$;

-- ---------------------------------------------------------------------------
-- 1. shops — who owns which shop (the authorization anchor)
-- ---------------------------------------------------------------------------
create table if not exists public.shops (
  id         uuid        primary key default gen_random_uuid(),
  owner_id   uuid        not null references auth.users (id) on delete cascade,
  name       text        not null check (char_length(trim(name)) between 2 and 120),
  kind       text        not null default 'both' check (kind in ('parts', 'decor', 'both')),
  city       text,
  phone      text,
  is_active  boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shops_owner_idx on public.shops (owner_id);

-- ---------------------------------------------------------------------------
-- 2. orders — human-readable reference, e.g. MW-ORD-48219 / MW-DCR-48219
-- ---------------------------------------------------------------------------
create sequence if not exists public.order_ref_seq start with 48219;

create table if not exists public.orders (
  id               uuid          primary key default gen_random_uuid(),
  order_ref        text          not null unique,
  customer_id      uuid          not null default auth.uid() references auth.users (id) on delete cascade,
  shop_id          uuid          not null references public.shops (id) on delete restrict,
  item_type        text          not null check (item_type in ('parts', 'decor')),
  status           text          not null default 'pending'
                                 check (status in ('pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled')),
  -- Recomputed inside place_order(); never accepted from a client.
  total_amount     numeric(12,2) not null default 0 check (total_amount >= 0),
  currency         text          not null default 'INR',
  delivery_name    text,
  delivery_mobile  text,
  delivery_city    text,
  delivery_address text,
  delivery_pincode text,
  notes            text,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now()
);

create index if not exists orders_customer_idx on public.orders (customer_id, created_at desc);
create index if not exists orders_shop_idx     on public.orders (shop_id, created_at desc);
create index if not exists orders_status_idx   on public.orders (status, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. order_items
-- ---------------------------------------------------------------------------
create table if not exists public.order_items (
  id         uuid          primary key default gen_random_uuid(),
  order_id   uuid          not null references public.orders (id) on delete cascade,
  product_id text          not null check (char_length(trim(product_id)) > 0),
  name       text,
  quantity   integer       not null check (quantity > 0),
  price      numeric(12,2) not null check (price >= 0),
  created_at timestamptz   not null default now()
);

create index if not exists order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- 4. help_desk_tickets — "wrong item received" / "damaged item"
-- ---------------------------------------------------------------------------
create table if not exists public.help_desk_tickets (
  id              uuid        primary key default gen_random_uuid(),
  order_id        uuid        not null references public.orders (id) on delete cascade,
  customer_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  issue_type      text        not null check (issue_type in ('wrong_item', 'damaged_item', 'missing_item', 'other')),
  description     text        not null check (char_length(trim(description)) between 10 and 2000),
  status          text        not null default 'pending' check (status in ('pending', 'resolved')),
  resolution_note text,
  resolved_at     timestamptz,
  resolved_by     uuid        references auth.users (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists tickets_order_idx    on public.help_desk_tickets (order_id, created_at desc);
create index if not exists tickets_customer_idx on public.help_desk_tickets (customer_id, created_at desc);

-- One open ticket per (order, issue type): repeats are refused instead of
-- filling the queue with duplicates of the same complaint.
create unique index if not exists tickets_one_open_per_issue
  on public.help_desk_tickets (order_id, issue_type)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- 5. updated_at upkeep
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

drop trigger if exists shops_touch on public.shops;
create trigger shops_touch before update on public.shops
  for each row execute function public.touch_updated_at();

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

drop trigger if exists tickets_touch on public.help_desk_tickets;
create trigger tickets_touch before update on public.help_desk_tickets
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Authorization helpers (security definer: they must see past RLS)
-- ---------------------------------------------------------------------------
create or replace function public.owns_shop(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shops s
    where s.id = p_shop_id and s.owner_id = auth.uid()
  );
$$;

create or replace function public.is_order_shop_owner(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    join public.shops s on s.id = o.shop_id
    where o.id = p_order_id and s.owner_id = auth.uid()
  );
$$;

create or replace function public.can_read_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order_id
      and (o.customer_id = auth.uid() or public.is_order_shop_owner(o.id) or public.is_staff())
  );
$$;

-- ---------------------------------------------------------------------------
-- 7. place_order — one transaction, server-computed total
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  p_shop_id   uuid,
  p_item_type text,
  p_items     jsonb,
  p_delivery  jsonb default '{}'::jsonb,
  p_notes     text  default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_order public.orders%rowtype;
  v_total numeric(12,2) := 0;
  v_item  jsonb;
  v_qty   integer;
  v_price numeric(12,2);
  v_ref   text;
  v_delivery jsonb := coalesce(p_delivery, '{}'::jsonb);
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_item_type is null or p_item_type not in ('parts', 'decor') then
    raise exception 'invalid_item_type';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'no_items';
  end if;

  if jsonb_array_length(p_items) > 100 then
    raise exception 'too_many_items';
  end if;

  if not exists (select 1 from public.shops s where s.id = p_shop_id and s.is_active) then
    raise exception 'shop_not_found';
  end if;

  -- Validate every line and add it up here: the client's own total is ignored.
  for v_item in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object'
       or coalesce(trim(v_item ->> 'product_id'), '') = ''
       or (v_item ->> 'quantity') is null
       or (v_item ->> 'quantity') !~ '^[0-9]+$'
       or (v_item ->> 'price')    is null
       or (v_item ->> 'price')    !~ '^[0-9]+(\.[0-9]{1,2})?$' then
      raise exception 'invalid_item';
    end if;

    v_qty   := (v_item ->> 'quantity')::integer;
    v_price := (v_item ->> 'price')::numeric(12,2);

    if v_qty < 1 or v_price < 0 then
      raise exception 'invalid_item';
    end if;

    v_total := v_total + (v_qty * v_price);
  end loop;

  v_ref := 'MW-' || case when p_item_type = 'decor' then 'DCR' else 'ORD' end
           || '-' || lpad(nextval('public.order_ref_seq')::text, 5, '0');

  insert into public.orders (
    order_ref, customer_id, shop_id, item_type, total_amount,
    delivery_name, delivery_mobile, delivery_city, delivery_address, delivery_pincode, notes
  )
  values (
    v_ref, v_uid, p_shop_id, p_item_type, round(v_total, 2),
    nullif(trim(coalesce(v_delivery ->> 'name', '')), ''),
    nullif(trim(coalesce(v_delivery ->> 'mobile', '')), ''),
    nullif(trim(coalesce(v_delivery ->> 'city', '')), ''),
    nullif(trim(coalesce(v_delivery ->> 'address', '')), ''),
    nullif(trim(coalesce(v_delivery ->> 'pincode', '')), ''),
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning * into v_order;

  insert into public.order_items (order_id, product_id, name, quantity, price)
  select
    v_order.id,
    trim(i ->> 'product_id'),
    nullif(trim(coalesce(i ->> 'name', '')), ''),
    (i ->> 'quantity')::integer,
    round((i ->> 'price')::numeric(12,2), 2)
  from jsonb_array_elements(p_items) i;

  return to_jsonb(v_order) || jsonb_build_object(
    'order_items',
    coalesce(
      (select jsonb_agg(to_jsonb(oi) order by oi.product_id)
       from public.order_items oi where oi.order_id = v_order.id),
      '[]'::jsonb
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. report_order_issue — help desk ticket for wrong / damaged items
-- ---------------------------------------------------------------------------
create or replace function public.report_order_issue(
  p_order_id   uuid,
  p_issue_type text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_order  public.orders%rowtype;
  v_ticket public.help_desk_tickets%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_issue_type is null
     or p_issue_type not in ('wrong_item', 'damaged_item', 'missing_item', 'other') then
    raise exception 'invalid_issue_type';
  end if;

  if p_description is null or char_length(trim(p_description)) < 10
     or char_length(p_description) > 2000 then
    raise exception 'invalid_description';
  end if;

  select * into v_order from public.orders o where o.id = p_order_id;
  if not found then
    raise exception 'order_not_found';
  end if;

  -- Only the customer who placed the order may report a problem with it.
  if v_order.customer_id <> v_uid then
    raise exception 'not_your_order';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'order_cancelled';
  end if;

  if exists (
    select 1 from public.help_desk_tickets t
    where t.order_id = p_order_id and t.issue_type = p_issue_type and t.status = 'pending'
  ) then
    raise exception 'issue_already_open';
  end if;

  insert into public.help_desk_tickets (order_id, customer_id, issue_type, description)
  values (p_order_id, v_uid, p_issue_type, trim(p_description))
  returning * into v_ticket;

  return to_jsonb(v_ticket);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Row level security
--    A customer sees their own orders; a shop owner sees the orders placed with
--    their shop; staff (`public.is_staff()`) see everything. Writes to orders
--    and tickets go through the two functions above, so there is deliberately
--    no INSERT policy on `orders` or `order_items`.
-- ---------------------------------------------------------------------------
alter table public.shops             enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.help_desk_tickets enable row level security;

-- shops: signed-in apps need to read active shops to place an order.
drop policy if exists "shops read active" on public.shops;
create policy "shops read active" on public.shops
  for select to authenticated
  using (is_active or owner_id = auth.uid() or public.is_staff());

drop policy if exists "shops insert self" on public.shops;
create policy "shops insert self" on public.shops
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "shops update owner" on public.shops;
create policy "shops update owner" on public.shops
  for update to authenticated
  using (owner_id = auth.uid() or public.is_staff())
  with check (owner_id = auth.uid() or public.is_staff());

-- orders: read for the customer, the shop owner, or staff.
drop policy if exists "orders read" on public.orders;
create policy "orders read" on public.orders
  for select to authenticated
  using (customer_id = auth.uid() or public.owns_shop(shop_id) or public.is_staff());

-- The shop moves an order along (pending → confirmed → …). Customers cannot
-- update orders: a status is a fulfilment fact, not a client claim.
drop policy if exists "orders shop update" on public.orders;
create policy "orders shop update" on public.orders
  for update to authenticated
  using (public.owns_shop(shop_id) or public.is_staff())
  with check (public.owns_shop(shop_id) or public.is_staff());

-- order_items follow their order's visibility.
drop policy if exists "order_items read" on public.order_items;
create policy "order_items read" on public.order_items
  for select to authenticated
  using (public.can_read_order(order_id));

-- tickets: the customer who filed it, the shop that has to fix it, and staff.
drop policy if exists "tickets read" on public.help_desk_tickets;
create policy "tickets read" on public.help_desk_tickets
  for select to authenticated
  using (
    customer_id = auth.uid()
    or public.is_order_shop_owner(order_id)
    or public.is_staff()
  );

-- The shop (or staff) marks a ticket resolved.
drop policy if exists "tickets shop update" on public.help_desk_tickets;
create policy "tickets shop update" on public.help_desk_tickets
  for update to authenticated
  using (public.is_order_shop_owner(order_id) or public.is_staff())
  with check (public.is_order_shop_owner(order_id) or public.is_staff());

-- ---------------------------------------------------------------------------
-- 10. Grants
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.shops             to authenticated;
grant select, update                 on public.orders            to authenticated;
grant select                         on public.order_items       to authenticated;
grant select, update                 on public.help_desk_tickets to authenticated;

-- The API calls these through a signed-in session; anonymous keys get nothing.
revoke all on function public.place_order(uuid, text, jsonb, jsonb, text) from public, anon;
revoke all on function public.report_order_issue(uuid, text, text)        from public, anon;
grant execute on function public.place_order(uuid, text, jsonb, jsonb, text) to authenticated;
grant execute on function public.report_order_issue(uuid, text, text)        to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 11. Self-test — prints one row per check, all must say OK
-- ---------------------------------------------------------------------------
drop table if exists _orders_selftest;
create temp table _orders_selftest (check_name text, result text);

do $$
declare
  missing text := '';
  n int;
begin
  if to_regclass('public.shops') is null then missing := missing || ' shops'; end if;
  if to_regclass('public.orders') is null then missing := missing || ' orders'; end if;
  if to_regclass('public.order_items') is null then missing := missing || ' order_items'; end if;
  if to_regclass('public.help_desk_tickets') is null then missing := missing || ' help_desk_tickets'; end if;

  insert into _orders_selftest
  values ('tables', case when missing = '' then 'OK' else 'MISSING:' || missing end);

  select count(*) into n from pg_class c
  join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public'
    and c.relname in ('shops', 'orders', 'order_items', 'help_desk_tickets')
    and c.relrowsecurity;
  insert into _orders_selftest
  values ('row level security', case when n = 4 then 'OK (4 tables)' else 'NOT ENABLED on ' || (4 - n) || ' table(s)' end);

  select count(*) into n from pg_policies
  where schemaname = 'public'
    and tablename in ('shops', 'orders', 'order_items', 'help_desk_tickets');
  insert into _orders_selftest
  values ('policies', case when n >= 7 then 'OK (' || n || ')' else 'TOO FEW (' || n || ')' end);

  select count(*) into n from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname in ('place_order', 'report_order_issue', 'owns_shop', 'is_order_shop_owner', 'can_read_order');
  insert into _orders_selftest
  values ('functions', case when n = 5 then 'OK (5)' else 'MISSING (' || n || '/5)' end);

  if to_regclass('public.orders') is not null
     and (select relkind from pg_class where oid = 'public.orders'::regclass) <> 'r' then
    insert into _orders_selftest values ('orders is a table', 'NO — still a view, the drop at the top failed');
  else
    insert into _orders_selftest values ('orders is a table', 'OK');
  end if;

  insert into _orders_selftest
  values ('legacy_orders view',
    case
      when to_regclass('public.legacy_orders') is not null then 'OK'
      when to_regclass('public.leads') is null then 'SKIPPED (run schema.sql first)'
      else 'MISSING'
    end);

  insert into _orders_selftest
  values ('shops registered', (select count(*)::text from public.shops where is_active));
end;
$$;

select check_name, result from _orders_selftest;

-- ---------------------------------------------------------------------------
-- 12. Register a shop (needed before any order can be placed)
-- ---------------------------------------------------------------------------
-- Every order points at a shop, and a shop belongs to a Supabase Auth user.
-- Find the ids you have:
--     select id, email, is_anonymous from auth.users order by created_at desc limit 20;
-- Then create the shop that account owns:
--     insert into public.shops (owner_id, name, kind, city, phone)
--     values ('<auth user uuid>', 'Sharma Auto Parts', 'parts', 'Pune', '9820011223');
--
-- Registering the shop owner with a real email/password account (not an
-- anonymous visitor) is what lets them sign in on the shop app:
--     insert into public.staff (user_id, email, role)
--     values ('<auth user uuid>', 'owner@sharmaautoparts.in', 'partner')
--     on conflict (user_id) do nothing;
-- ---------------------------------------------------------------------------
