# Motor Wallah API layer

One HTTP API for the four planned mobile apps (Dealers, Workshops, Auto Parts
Shops, Decor Shops) and the existing website. Every endpoint is a TanStack Start
server route under `src/routes/api/`, so it runs on the same deployment as the
site — no second server to host.

- **Base URL** — the site origin, e.g. `https://<preview-host>`. Paths are absolute: `https://<host>/api/orders`.
- **Format** — JSON in, JSON out, `snake_case` keys that match the database columns.
- **Auth** — `Authorization: Bearer <supabase access token>` on every request.
- **CORS** — `OPTIONS` is answered on every endpoint with `access-control-allow-origin: *`. The token travels in a header, never a cookie, so a wildcard origin gives nothing away.

## Authentication

The API trusts only the Supabase access token. It is verified with
`auth.getUser(token)` on every call, and the user id from that token — **not** a
value from the body or the path — is what scopes every query.

| Who | How they sign in | What they can reach |
| --- | --- | --- |
| Customer (buyer) | `supabase.auth.signInAnonymously()`, or a real account | Own order history, own orders' issues |
| Shop owner (parts / decor) | Email + password account, plus a `shops` row they own | Orders placed with their shop, tickets raised on them |
| Motor Wallah staff | Account in `public.staff` | Everything (via the same RLS policies) |

A shop owner is registered in two places: a Supabase Auth user, and a row in
`public.shops` whose `owner_id` is that user. See the end of
[`supabase/orders-helpdesk.sql`](../supabase/orders-helpdesk.sql) for the two
`insert`s.

The mobile apps keep the session themselves (`supabase-js` with
`persistSession: true`) and send `session.access_token`; on a `401` they should
refresh the session once and retry.

## Response shapes

Success:

```json
{ "data": { }, "meta": { } }
```

`data` is an object for a single order or ticket, an array for a list. `meta` is
present on lists only.

Failure — one shape for every endpoint and status:

```json
{
  "error": {
    "code": "bad_request",
    "message": "The order payload is not valid.",
    "details": { "items": ["Send at least one line item"] }
  }
}
```

| Status | `code` | Meaning |
| --- | --- | --- |
| 400 | `bad_request` | Body is not JSON, or a field failed validation (`details` says which) |
| 401 | `unauthorized` | Missing, malformed or expired access token |
| 403 | `forbidden` | Signed in, but this row belongs to someone else |
| 404 | `not_found` | No such order or shop |
| 409 | `conflict` | Duplicate open ticket, or the order is cancelled |
| 503 | `database_not_ready` | The SQL from `supabase/orders-helpdesk.sql` has not been run |

---

## Parts & Decor — live now

### `POST /api/orders`

Places an order. The order row and its line items are written in one database
transaction by `public.place_order`, and **the total is computed from the line
items on the server** — a `total_amount` sent by the app is ignored.

```bash
curl -X POST "$BASE/api/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shop_id": "8a4f…",
    "item_type": "parts",
    "items": [
      { "product_id": "st-9", "name": "Alloy wheel 15\"", "quantity": 2, "price": 4800 },
      { "product_id": "st-14", "name": "Brake pad set", "quantity": 1, "price": 1450 }
    ],
    "delivery": { "name": "Rohit Sharma", "mobile": "9820011223", "city": "Pune", "pincode": "411001" },
    "notes": "Call before delivery"
  }'
```

| Field | Type | Rules |
| --- | --- | --- |
| `shop_id` | uuid | Must reference an active shop |
| `item_type` | `"parts"` \| `"decor"` | Also decides the reference prefix (`MW-ORD-` / `MW-DCR-`) |
| `items[]` | array | 1–100 items; `product_id` required, `quantity` integer ≥ 1, `price` (unit, rupees) ≥ 0 |
| `delivery` | object | Optional; `mobile` 10–15 digits, `pincode` 6 digits |
| `notes` | string | Optional, ≤ 1000 characters |

`201 Created` returns the order in the same shape as the history endpoint,
including `order_ref` such as `MW-ORD-48219`.

### `GET /api/users/{id}/orders`

The customer's order history, newest first. `{id}` must be the caller's own user
id; anyone else gets `403`.

Query string: `status` (`pending` … `cancelled`), `item_type` (`parts` \| `decor`), `limit` (1–100, default 50).

```bash
curl "$BASE/api/users/$USER_ID/orders?item_type=parts&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

### `GET /api/shops/{id}/orders`

Every order for one shop, for the shop's fulfilment screen. The caller must own
the shop, otherwise `403`.

Same query string as above. `meta.open_tickets` counts the pending tickets across
the returned orders, so the app can badge the help desk.

### `POST /api/orders/{id}/report-issue`

Help desk: the customer reports a wrong or damaged item. Only the customer who
placed the order can report it, and only once per issue type while a ticket is
open (`409` if repeated).

```bash
curl -X POST "$BASE/api/orders/$ORDER_ID/report-issue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "issue_type": "damaged_item",
    "description": "The left tail lamp arrived cracked; the box was crushed on one corner."
  }'
```

| `issue_type` | Used for |
| --- | --- |
| `wrong_item` | A different product arrived |
| `damaged_item` | Arrived broken, scratched or leaking |
| `missing_item` | Quantity short |
| `other` | Anything else |

`201 Created`:

```json
{
  "data": {
    "id": "…",
    "order_id": "…",
    "issue_type": "damaged_item",
    "description": "The left tail lamp arrived cracked; …",
    "status": "pending",
    "created_at": "2026-11-06T09:12:44.318Z"
  }
}
```

A ticket is `pending` until the shop or staff marks it `resolved`. Tickets appear
inside every order returned by the two list endpoints, and on the order the
customer just reported.

### Order object

```json
{
  "id": "…",
  "order_ref": "MW-ORD-48219",
  "customer_id": "…",
  "shop_id": "…",
  "shop": { "id": "…", "name": "Sharma Auto Parts", "kind": "parts", "city": "Pune", "phone": "9820011223" },
  "item_type": "parts",
  "status": "pending",
  "total_amount": 11050,
  "currency": "INR",
  "delivery": { "name": "Rohit Sharma", "mobile": "9820011223", "city": "Pune", "address": null, "pincode": "411001" },
  "notes": "Call before delivery",
  "created_at": "2026-11-06T09:10:02.114Z",
  "updated_at": "2026-11-06T09:10:02.114Z",
  "items": [
    { "id": "…", "product_id": "st-9", "name": "Alloy wheel 15\"", "quantity": 2, "price": 4800 }
  ],
  "tickets": [
    { "id": "…", "issue_type": "damaged_item", "description": "…", "status": "pending", "resolution_note": null, "created_at": "…", "resolved_at": null }
  ]
}
```

`status` moves `pending → confirmed → packed → shipped → delivered`, or
`cancelled`. A shop can change it directly in the database today (the
`orders shop update` policy allows the owning shop only); a
`PATCH /api/shops/{id}/orders/{orderId}` endpoint is the next step and is not
built yet.

---

## Dealer & Workshop — not built yet

The brief lists these as "existing", but this deployment has no server-side
dealer or workshop API: dealer inventory, leads, offers and workshop bookings
live in the app's own store (`app_records` + `leads`), which the browser reads
from a synchronised on-device replica. Exposing them over HTTP means giving
those rows real tables first, exactly like orders got in this change.

The contract the mobile apps can be written against, once those tables exist:

| Endpoint | Purpose | Tables it needs |
| --- | --- | --- |
| `GET /api/dealers/{id}/inventory` | A dealer's listings, already scoped to their category | `dealers`, `dealer_vehicles` |
| `GET /api/dealers/{id}/leads` | Enquiries + offers for that dealer | `leads`, `listing_offers` |
| `PATCH /api/leads/{id}` | Mark a lead contacted / closed | `leads` |
| `GET /api/workshops/{id}/bookings` | Service bookings for a workshop | `workshops`, `service_bookings` |
| `GET /api/workshops/{id}/job-cards` | Open and closed job cards | `job_cards`, `job_card_items` |
| `GET /api/vehicles/{id}/history` | Every service visit for one vehicle | `job_cards` (joined on registration) |

These would follow the same rules as the endpoints above: the token decides the
dealer/workshop, path ids are only checked against it, and RLS backs every query.

## Files

| File | What it holds |
| --- | --- |
| `src/routes/api/orders/index.ts` | `POST /api/orders` |
| `src/routes/api/users/$id/orders.ts` | `GET /api/users/{id}/orders` |
| `src/routes/api/shops/$id/orders.ts` | `GET /api/shops/{id}/orders` |
| `src/routes/api/orders/$id/report-issue.ts` | `POST /api/orders/{id}/report-issue` |
| `src/lib/api/auth.ts` | Bearer token → verified caller, error mapping |
| `src/lib/api/http.ts` | JSON, CORS, validation-error helpers |
| `src/lib/api/orders.ts` | Zod schemas, row → response mapping, list filters |
| `src/lib/orders-api.ts` | Browser client: token, `placeOrder`, `listMyOrders`, `reportOrderIssue` |
| `src/routes/account.tsx` | "My Orders" dashboard tab + help desk form |
| `src/routes/accessories.tsx`, `src/routes/decor.tsx` | Checkout posts the paid cart to `POST /api/orders` |
| `supabase/orders-helpdesk.sql` | Tables, RLS, `place_order`, `report_order_issue` |
| `supabase/storefront-shop.sql` | The marketplace shop the website checkout sells through |

Both storefront checkouts post the paid cart themselves (`saveOrderToApi` in the
routes, `placeOrder` in the client). The shop id is the constant
`STOREFRONT_SHOP_ID`; it must match the row created by
`supabase/storefront-shop.sql`, or be overridden with `VITE_STOREFRONT_SHOP_ID`.
If the order cannot be saved the customer still sees the confirmation screen,
with the payment id and a note to quote it.
