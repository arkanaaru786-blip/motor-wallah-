-- ---------------------------------------------------------------------------
-- Motor Wallah storefront shop
--
-- Every order points at a shop (`orders.shop_id`). The website sells Motor
-- Wallah's own stock rather than a third-party seller's, so it needs one
-- marketplace-owned row: the "Motor Wallah Store", whose owner is the
-- marketplace itself and therefore nobody (owner_id null).
--
-- Run after supabase/orders-helpdesk.sql. Safe to run twice.
--
-- The id below is the same constant the site posts to (STOREFRONT_SHOP_ID in
-- src/lib/orders-api.ts, overridable with VITE_STOREFRONT_SHOP_ID). If you
-- change one, change both.
-- ---------------------------------------------------------------------------

-- A marketplace shop has no owning account. Shops registered by a real shop
-- owner still require one — the insert policy checks owner_id = auth.uid().
alter table public.shops alter column owner_id drop not null;

insert into public.shops (id, owner_id, name, kind, city, phone, is_active)
values (
  '8f4b2c1e-6a3d-4f7b-9c2e-1d5a7b9c0e3f',
  null,
  'Motor Wallah Store',
  'both',
  'Pune',
  '8080808080',
  true
)
on conflict (id) do update
  set owner_id = excluded.owner_id,   -- clears an owner set by an earlier run
      name = excluded.name,
      kind = excluded.kind,
      city = excluded.city,
      phone = excluded.phone,
      is_active = true;

-- Reassign the storefront to a real staff account later, if the shop team
-- should see storefront orders in the shop app:
--     update public.shops set owner_id = '<auth user uuid>'
--     where id = '8f4b2c1e-6a3d-4f7b-9c2e-1d5a7b9c0e3f';

-- Until this file runs, the site creates the shop through the normal
-- "shops insert self" policy, which makes the browser session that placed the
-- first order the owner. Re-running this statement clears that owner again.

select id, name, kind, city, owner_id, is_active
from public.shops
where id = '8f4b2c1e-6a3d-4f7b-9c2e-1d5a7b9c0e3f';
