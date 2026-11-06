# Supabase setup

The app stores its data in Supabase instead of `localStorage`. Visitors get a
real (anonymous) session, so row level security can scope every row to its owner.

> **If inserts fail with `42501 new row violates row level security policy`**,
> run [`fix-rls.sql`](./fix-rls.sql) in the SQL editor. It drops whatever policies
> exist, recreates one known-good set, seeds the default site settings, rebuilds
> the reporting views, and then self-tests the exact insert the site makes — the
> last result set tells you whether the write path works before you retry the
> browser. It is safe to re-run.

## 1. Create the tables

Supabase dashboard → **SQL Editor** → **New query** → paste all of
[`schema.sql`](./schema.sql) → **Run**. It is idempotent, so re-running is safe.
Then run [`fix-rls.sql`](./fix-rls.sql) once and read its self-test output.

Finally run [`orders-helpdesk.sql`](./orders-helpdesk.sql) — the Parts & Decor
order tables, the help desk tickets and the two functions the API calls. It
prints a self-test at the end; every row must say `OK`. It replaces the old
`orders` reporting view with the real `orders` table and recreates that view as
`legacy_orders`.

Then run [`storefront-shop.sql`](./storefront-shop.sql) once: every order points
at a shop, and this creates the marketplace-owned "Motor Wallah Store" the
website's Parts and Decor checkout sells through. Until it runs, the site
creates that shop itself under the first visitor's session, so the order owner
ends up in the `shops` table — running the file clears it again.

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

### Editing site settings from the admin panel

**Master Control → Site Settings** changes the support phone, dial link, WhatsApp
link and support inbox. Saving is a database write, so the screen asks for a
separate staff sign-in (email + password of the user you added above) the first
time — the panel's own login is a local credential check that Supabase knows
nothing about. That staff session is stored under `mw_staff_auth`, separately
from the visitor session, so signing in never moves a customer's cart or chats.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `42501 ... row level security` on every write | policies missing or wrong: run `fix-rls.sql` |
| `PGRST205 Could not find the table` | `schema.sql` never ran against this project |
| `PGRST205` only for `vehicles` / `legacy_orders` | views missing: run `fix-rls.sql` |
| API returns 503 `database_not_ready` | `orders-helpdesk.sql` has not been run |
| Settings save says “only staff” | no staff session, or the account is not in `public.staff` |
| App shows “offline” | anonymous sign-ins are disabled, or the tables are unreachable |

## Where the data lives

| Previously (localStorage key) | Now |
| --- | --- |
| `mw_lead_queue` | `app_records` (key) + one structured row per lead in `leads` |
| `mw_buy_shortlist` | `app_records` (key) |
| `mw_customer_profiles` | `app_records` (key) |
| `mw_listing_chat`, `mw_chat_read`, `mw_chat_pending` | `app_records` (keys) |
| `mw_listing_offers`, `mw_my_listing_status` | `app_records` (keys) |
| `mw_decor_cart`, `mw_parts_cart` | `app_records` (keys) |
| parts / decor orders placed by the mobile apps | `orders` + `order_items` (via `POST /api/orders`) |
| wrong / damaged item reports | `help_desk_tickets` (via `POST /api/orders/{id}/report-issue`) |
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
