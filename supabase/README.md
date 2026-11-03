# Supabase setup

The app now stores everything in Supabase instead of `localStorage`. Three steps
finish the setup — the site keeps working from its on-device replica until they
are done, and never shows an error while they are pending.

## 1. Create the tables

Supabase dashboard → **SQL Editor** → **New query** → paste all of
[`schema.sql`](./schema.sql) → **Run**. It is idempotent, so re-running is safe.

## 2. Enable anonymous sign-ins

Dashboard → **Authentication** → **Sign In / Providers** → **Anonymous sign-ins**
→ **Enable**.

Every visitor gets a real `auth.users` row this way, which is what lets RLS scope
rows with `auth.uid()`. Until it is enabled the app reports "offline" and keeps
data on the device only.

## 3. Give the admin console read access (optional but required for cross-device CRM)

1. Dashboard → **Authentication** → **Users** → **Add user** (email + password).
2. Copy the new user's UUID and run:

```sql
insert into public.staff (user_id, email, role)
values ('<uuid>', 'you@example.com', 'super_admin')
on conflict (user_id) do update set email = excluded.email, role = excluded.role;
```

`public.is_staff()` then returns true for that user, and the `leads`, `profiles`
and `app_records` staff policies return every row instead of just their own.

## Where the data lives

| Previously (localStorage key) | Now |
| --- | --- |
| `mw_lead_queue` | `app_records` (key) + one structured row per lead in `leads` |
| `mw_buy_shortlist` | `app_records` (key) |
| `mw_customer_profiles` | `app_records` (key) |
| `mw_listing_chat`, `mw_chat_read`, `mw_chat_pending` | `app_records` (keys) |
| `mw_listing_offers`, `mw_my_listing_status` | `app_records` (keys) |
| `mw_decor_cart`, `mw_parts_cart` | `app_records` (keys) |
| `mw_admin_*` (cases, employees, audit, rules, runs, reconcile) | `app_records` (keys) |
| `PHONE_DISPLAY` / `WHATSAPP` constants | `site_settings` (world-readable, staff-writable) |

Device-only by design, never uploaded: `mw_admin_session`, `mw_customer_session`,
`mw_admin_attempts` (lockout counter), `mw_supabase_auth` (the Supabase session)
and the write timestamps `mw_synced_at:*`.

## How syncing works

`src/lib/cloud-store.ts` is the whole data layer:

* **reads** are synchronous from an on-device replica, so no UI had to become
  async and nothing blocks on the network;
* **writes** update the replica first and push to `app_records` after a short
  debounce, with retries and a re-flush when the browser comes back online;
* **start-up** pulls every row for the session's owner and the newest copy wins
  per key, so a change made offline is not lost. Collections that only ever
  existed in `localStorage` are uploaded on the first run (migration);
* **reactivity**: the root route subscribes to the layer and re-renders once the
  cloud copy lands, so every store re-reads the fresh replica.
