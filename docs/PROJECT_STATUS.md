# NearKart — Project Status

**Last updated:** 2026-10-23
**Current phase:** Phase 6 complete — Google Maps store locations, Routes API delivery estimates and configurable delivery fees
**Database:** local MongoDB at `mongodb://127.0.0.1:27017`, database `nearkart`

---

## Completed

### Phase 1 — foundation
- Independent `client/` and `server/` npm packages, TypeScript, Vite proxy.
- Responsive navy/teal/white landing page and real API status badge.
- Express app with `/api/health`, JSON 404 and error handlers, `helmet`.

### Phase 2 — MongoDB connection and initialization
- Official `mongodb` driver, one reusable `MongoClient` pool.
- Startup connects, pings the database and ensures indexes before listening.
- Collections with indexes: `users`, `sessions`, `stores`, `products`,
  `carts`, `orders`, `deliveryLocations`, `deliveryEvents`, `reviews`,
  `favourites`.
- `sessions.tokenHash` unique, `sessions.expiresAt` TTL, `users.email` unique.
- `/api/health` reports `backend.status` and `database.status` separately.

### Phase 3 — authentication and roles
- Customer and seller registration with zod validation; no public driver or
  admin registration.
- Login, logout, `GET /api/auth/me`, 7-day server-side sessions.
- Passwords hashed with bcryptjs (cost 12); only SHA-256 token hashes stored.
- `httpOnly`, `SameSite=Lax` session cookie (`Secure` in production).
- `requireAuth` and `requireRole` middleware; suspended users rejected.
- Admin-only driver/admin creation endpoints.
- One-time `npm run seed:admin` bootstrap; never prints the password.
- Responsive `/login`, `/register` (customer/seller toggle), `/account`, with
  protected routing and admin-only driver creation form.
- Rate limiting on auth endpoints; generic login error message.
- Integration tests covering auth, unauthorized access and role restrictions.

### Phase 4 — stores, products and marketplace

**Backend**
- Seller store module with one store per seller, auto-generated unique slug,
  owner-scoped reads/updates and seller-only routes.
- Product module using the `products` collection with `ObjectId` references to
  `sellerId` and `storeId`, plus `createdAt` and `updatedAt`.
- Fixed category set; prices stored and returned as integer paise (`pricePaise`);
  stock, low-stock threshold, image URL and active/paused state validated.
- Seller-only product create, list, update and delete. Ownership is checked in
  the service with `{ _id, sellerId: req.user.id }`.
- Public product list and detail endpoints. Only `isActive: true` products from
  `active` stores are public; out-of-stock products stay visible.
- Search, category, price, availability, page and limit filters validated with
  zod. Invalid ObjectIds return `400`; missing products return `404`.
- Store/product indexes, including unique `stores.ownerId` and `stores.slug`.

**Frontend**
- Public `/marketplace` with real product cards, store names, category, price,
  availability badges, loading skeletons, empty and error states.
- Search, category, price-range and availability filters plus pagination.
- `/marketplace/:id` product detail page with image fallback and explicit
  delivery-pending note.
- Protected `/seller` dashboard for store profile, product create/edit, stock,
  pause and delete flows.

### Phase 5 — cart, checkout, orders and inventory

**Backend**
- Authenticated, server-side cart in the `carts` collection keyed by `userId`.
  One cart per customer, one store per cart for the MVP, with quantity limits
  and live product/stock availability in every response.
- Cart routes: read, add item, update quantity, remove item and clear. The cart
  survives logout/login because it is stored in MongoDB, not browser state.
- Checkout reads the cart from MongoDB, reloads every product, and recalculates
  the subtotal, delivery placeholder and total on the server. Client-supplied
  prices, stock or totals are never accepted.
- Purchase-time snapshots (`name`, `imageUrl`, `pricePaise`, `quantity`,
  `lineTotalPaise`) are copied into the order. Later product edits do not change
  an existing order.
- Stock is reserved with atomic conditional `findOneAndUpdate` operations that
  require matching `_id`, `storeId`, `isActive`, `pricePaise` and
  `stock >= quantity`. A failed reservation releases earlier reservations, so a
  failed checkout creates no order and consumes no stock.
- Duplicate checkout protection uses a unique sparse
  `orders.idempotencyKey` index. Repeating the same key returns the existing
  order without deducting stock again. A key used by another customer returns
  `409 IDEMPOTENCY_CONFLICT`.
- Order status flow:
  `pending → confirmed → preparing → ready_for_pickup → delivered`.
  Sellers can cancel from `pending`, `confirmed` or `preparing`; cancellation
  restores stock and records `stockRestored: true`. Cancellation after
  `ready_for_pickup` is rejected.
- Seller order routes are scoped to the authenticated seller's own store.
  Seller responses include customer name, phone, city, state, postal code and
  country, but intentionally omit street lines (`line1`, `line2`).
- Customer order list/detail and seller order list/detail/status routes enforce
  ownership in the service layer, not only in the UI.
- `orderNumber` uses `NK-YYYYMMDD-XXXXXX`; `orderNumber` and `idempotencyKey`
  are unique. Added cart and order indexes, including the unique order keys.
- Delivery fee remains an explicit placeholder: `deliveryFeePaise: 0` with
  `deliveryFeeStatus: "pending_maps_integration"`. No delivery quote is invented.

**Frontend**
- `CartProvider` loads and mutates the authenticated customer cart through the
  shared API wrapper. Header cart count is real and updates after mutations.
- Add-to-cart actions on product cards and product detail. Unauthenticated users
  are sent to login; sellers are told a customer account is required.
- `/cart` renders real items, stock, line totals, warnings for unavailable
  products, quantity steppers, remove, clear and an empty state. It explicitly
  labels delivery as pending and excludes it from the total.
- `/checkout` requires a customer session, collects delivery contact/address,
  reuses one idempotency key across retries and refreshes the cart when stock or
  price changes are reported by the server.
- `/orders` and `/orders/:id` show the customer's own orders, purchase-time
  items, totals, full delivery address and status history.
- `/seller/orders` gives sellers status filters, customer contact/area, item
  totals, status history and valid action buttons. Street lines are not shown.
- Responsive commerce styling and navigation for customer cart/orders and
  seller orders. No fake orders, prices, drivers or delivery quotes.

### Phase 6 — Google Maps locations and delivery estimates

**Backend**
- Optional store map pin (`location.latitude` / `location.longitude`) saved by
  the seller. Coordinates are validated by zod (`-90..90`, `-180..180`), rounded
  to six decimals, optionally cleared with `location: null`, and included in
  public store summaries. Existing stores without a pin remain valid.
- New customer-only `POST /api/delivery/quote`. The store is derived from the
  customer's own server-side cart, never from the request body, so a caller
  cannot quote or price an arbitrary store.
- Google Routes API (`directions/v2:computeRoutes`) is called server-side with a
  dedicated `GOOGLE_MAPS_API_KEY` that is never sent to the browser. The request
  asks for distance, duration, encoded polyline and leg endpoints for a driving
  route from the store pin to the geocoded delivery address.
- Delivery pricing is server-owned, configurable, and calculated in integer
  paise: base fee, per-kilometre fee, per-minute fee, minimum fee and maximum
  delivery distance. Billed kilometres/minutes are rounded up before pricing.
- Quote failures are explicit:
  - `MAPS_NOT_CONFIGURED` and `STORE_LOCATION_MISSING` allow checkout with a
    zero fee and `pending_maps_integration`.
  - `ADDRESS_INVALID`, `ROUTE_NOT_FOUND`, `ROUTE_UNAVAILABLE` and
    `ROUTE_TOO_LONG` block checkout (`DELIVERY_QUOTE_UNAVAILABLE` or
    `DELIVERY_OUT_OF_RANGE`).
- Order creation recalculates the quote from MongoDB; a browser-supplied fee,
  distance, destination coordinate or total is never accepted. Calculated
  orders persist the route snapshot, destination coordinates, fee and total.
- Seller order responses expose only the measured distance/duration and fee.
  Customer coordinates, the full route and the polyline remain private to the
  customer and the order record.
- `server/.env.example` documents the server Routes key, request timeout,
  pricing and maximum distance. No new npm dependencies were added.

**Frontend**
- `RouteMap` loads the Google Maps JavaScript API from a separate public browser
  key and renders store/delivery markers plus the server-returned route
  polyline. Missing key, missing points, load failure and loading each have an
  explicit state; no placeholder map is drawn.
- Seller store profile accepts latitude/longitude, offers a browser geolocation
  button, validates ranges and previews the pin on a map. Sellers may leave both
  fields blank.
- `/checkout` asks the server for a quote after the address is valid, shows the
  map, road distance, drive time and delivery fee, and blocks ordering for
  address/route failures. A missing Maps setup is labelled as pending, not
  priced.
- `/orders`, `/orders/:id` and `/seller/orders` display the calculated fee,
  distance/duration and delivery quote message where present. Seller views never
  receive or render customer coordinates or the route polyline.
- `client/.env.example` documents `VITE_GOOGLE_MAPS_API_KEY`, which must be
  restricted by HTTP referrer and must only enable the Maps JavaScript API.

## Verification results

All commands below were run on Windows with Node v24.13.1, npm 11.8.0 and local
MongoDB.

| Check | Command | Result |
| --- | --- | --- |
| Server type-check | `cd server; npm.cmd run typecheck` | Pass |
| Server production build | `cd server; npm.cmd run build` | Pass |
| Client type-check | `cd client; npm.cmd run typecheck` | Pass |
| Client production build | `cd client; npm.cmd run build` | Pass — 69 modules, 369.29 kB JS (106.92 kB gzip), 48.84 kB CSS (9.34 kB gzip) |
| Integration tests | `cd server; npm.cmd run test` | **54 passed, 0 failed, 0 skipped** in 8 suites (8.886 s) |
| Phase 6 live HTTP quote/order flow | `node dist/index.js` on port 4100 against temporary `nearkart_phase6_e2e` with `GOOGLE_MAPS_API_KEY=''` | Pass — quote reported `MAPS_NOT_CONFIGURED`, order stayed `pending_maps_integration`, seller response hid the address and route |
| Temporary database cleanup | drop `nearkart_phase6_e2e` after stopping the temporary API | Dropped |
| Normal dev API restored | `cd server; npm.cmd run dev` | Running on `http://localhost:4000`; health and DB status OK |
| Google Maps/Routes live success | Requires real keys and enabled APIs | **Not verified — no Maps or Routes credentials are configured** |

### Live end-to-end result

The live flow used real HTTP requests through the Vite proxy and confirmation
code against the temporary database:

- Registered two sellers and one customer; created two stores and three
  products.
- Added a product from store A, changed quantity to 2, and verified a
  second-store product was rejected with `409 CART_STORE_CONFLICT`.
- Logged out and back in; the cart still contained the two units.
- Placed order `NK-20261023-4E250C`; repeated the same idempotency key and
  received the same order ID. Product stock stayed at 8 after the duplicate.
- Seller order list returned both orders but no `deliveryAddress`, `line1` or
  `line2` for the seller.
- Seller moved the first order through `confirmed`, `preparing`,
  `ready_for_pickup` and `delivered`; the stored status history contains all
  five transitions including `pending`.
- Placed order `NK-20261023-4E250E` for the second product. Its stock changed
  from 5 to 3. Seller cancellation changed it back to 5 and stored
  `stockRestored: true`.
- Customer list and detail returned two orders with final statuses `delivered`
  and `cancelled`; the cart was empty after checkout.
- MongoDB contained exactly 3 users, 2 stores, 3 products, 2 orders and 0
  carts. The duplicate idempotency key had one order document. Order items,
  customer/store/seller references and status history were stored as expected.

The temporary database was stopped and dropped after verification. The normal
`nearkart` database was not used for the live flow and contains no `phase5_*`
users, stores or orders. At the time of this update it contains 3 users,
1 store, 1 product, 0 carts and 0 orders. The test suite uses `nearkart_test`
and drops it before and after each run.

Phase 5's live verification was HTTP-level through the running Vite proxy.
Automated browser clicking was not added; the production client build and
type-check pass, and the manual UI checklist below covers the same flow.

### Phase 6 live result (Maps credentials absent)

The temporary API on port 4100 used the separate `nearkart_phase6_e2e`
database with `GOOGLE_MAPS_API_KEY=''`:

- Registered a seller, created a store with pin `18.5204, 73.8567` and a
  product; registered a customer and added two units.
- `POST /api/delivery/quote` returned `status: "unavailable"`,
  `reason: "MAPS_NOT_CONFIGURED"`, `checkoutAllowed: true`,
  `deliveryFeePaise: 0`, subtotal `50000` and total `50000` with the explicit
  pending message. No fee was invented.
- `POST /api/orders` created the order with
  `deliveryFeeStatus: "pending_maps_integration"`, fee `0`, total `50000`, no
  `deliveryRoute`, and the same quote message.
- The seller order response contained no `deliveryAddress` and no
  `deliveryRouteSummary`; the customer session remained the only reader of the
  address.
- Store coordinates were returned publicly on the store response and on the
  cart's store summary.
- The temporary database was stopped and dropped. `nearkart` was not used for
  this flow.

The success path (a real road distance, duration, polyline and fee) is covered
by mocked-fetch unit tests, an order-level HTTP test that persists the route,
fee and seller-only route summary, and the pricing tests. It has **not** been
verified against the real Google Routes API because no credentials are
configured. The blocking path is also covered by an HTTP test that confirms an
unroutable address creates no order and reserves no stock.

## Inventory and failure behaviour

The local MongoDB server is standalone, so multi-document transactions are not
available. Checkout therefore uses this sequence:

1. Reload the cart and every product from MongoDB.
2. Build order snapshots with integer-paise totals.
3. Reserve each item with one atomic conditional update.
4. Insert the order only after every reservation succeeds.
5. Clear the cart after the order is safely inserted.

If any reservation fails, earlier reservations are released and no order is
inserted. If the order insert fails, all reservations are released. Duplicate
key races are handled by the unique index and return the original order.

**Remaining crash window:** if the API process dies after all stock
reservations succeed but before the order insert, those reservations are not
released automatically. This is the trade-off of compensating writes on a
standalone server. Moving checkout to a replica set and wrapping reservations
plus order insertion in a transaction is the correct long-term fix. A cart
cleanup failure after a successful insert is logged and does not invalidate the
order.

## Environment configuration

`server/.env` (gitignored; copy from `.env.example`):

```env
NODE_ENV=development
PORT=4000
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=nearkart
SESSION_COOKIE_NAME=nk_session
BCRYPT_SALT_ROUNDS=12
AUTH_RATE_LIMIT_MAX=20

# Phase 6: server-only Routes API key and delivery pricing (integer paise)
GOOGLE_MAPS_API_KEY=
GOOGLE_MAPS_REQUEST_TIMEOUT_MS=8000
DELIVERY_BASE_FEE_PAISE=2000
DELIVERY_PER_KM_PAISE=800
DELIVERY_PER_MINUTE_PAISE=0
DELIVERY_MIN_FEE_PAISE=2000
DELIVERY_MAX_DISTANCE_METERS=25000
```

`GOOGLE_MAPS_API_KEY` is server-only: enable **Routes API** for it, restrict it to
the server, and never copy it into a `VITE_` variable. Leave it blank to keep
delivery estimates explicitly pending.

`client/.env` (optional, gitignored):

```env
VITE_API_BASE=/api
VITE_GOOGLE_MAPS_API_KEY=
```

The browser key must enable only the **Maps JavaScript API** and be restricted by
HTTP referrer (`http://localhost:5173/*` and the production domain). It is public
and must not have Routes API permission. `ADMIN_NAME`, `ADMIN_EMAIL` and
`ADMIN_PASSWORD` are only for the first admin seed and should be removed from
`.env` afterwards. No server secret is exposed to the client.

At the time of this update, `server/.env` has no `GOOGLE_MAPS_API_KEY` and
`client/.env` does not exist. That is why the live check below reports Maps as
unconfigured rather than showing a route.

## Deliberate decisions

- **One store per cart for the MVP.** Mixing stores in one cart is rejected
  with `CART_STORE_CONFLICT`; multi-store checkout is a later feature.
- **Server owns money and stock.** Prices, line totals, subtotal and total are
  recalculated in integer paise. The client never sends totals.
- **Idempotent checkout.** The browser reuses one key for a checkout attempt.
  The unique key returns the existing order instead of charging stock twice.
- **Purchase-time snapshots.** Product edits do not rewrite historical orders.
- **Conditional reservation with compensation.** Failed checkouts release
  earlier reservations. The documented crash window is the cost of standalone
  MongoDB.
- **Seller cancellation restores stock once.** `stockRestored` records that the
  restore path completed. Cancellation is blocked after `ready_for_pickup`.
- **Seller privacy.** Sellers get contact details and the delivery area, never
  the customer's street lines.
- **Server owns delivery pricing.** Store pin, route distance, duration, fee and
  total are recalculated on the server in integer paise. The browser only sends
  address text and receives a quote.
- **Two Google keys, separate permissions.** The server Routes key is secret and
  server-only; the browser key is public, referrer-restricted and only allowed
  to load Maps JavaScript. Neither key is fabricated, and missing keys produce
  explicit unavailable states.
- **Address geocoding inside the route request.** The Routes API geocodes the
  delivery address and returns the destination coordinates, so the browser never
  supplies coordinates that the server would trust.
- **Fallback only for setup gaps.** Missing Maps configuration or a store pin
  allows an order with an explicit pending fee. Invalid addresses, missing
  routes, API failures and out-of-range distances block checkout.
- **No payments, GPS tracking, driver assignment or admin moderation in this
  phase.** Realtime driver location is Phase 7.

## Known limitations

- Local standalone MongoDB has no transactions. The checkout compensation flow
  has the documented reservation-to-insert crash window.
- One cart can only contain one store's products.
- No Google Maps or Routes credentials are configured in this workspace. The
  real route success path is implemented and unit-tested with mocked responses,
  but has not been exercised against Google. Without `VITE_GOOGLE_MAPS_API_KEY`
  the map shows an explicit unavailable state; without `GOOGLE_MAPS_API_KEY`
  quotes stay pending.
- Delivery pricing uses straight billed distance/time with no surge, weather,
  toll, weight or multi-stop rules.
- No saved address book; the customer enters delivery details at checkout.
- No customer-initiated cancellation or refunds yet. Seller cancellation is
  implemented for the allowed statuses.
- No payment collection, delivery scheduling, driver assignment, realtime GPS,
  admin moderation, reviews, favourites or seller analytics yet.
- Product images are external URLs; there is no upload/storage pipeline.
- Auth endpoints are rate limited; cart/product/order/delivery-quote writes are
  not separately rate limited.
- Phase 6 did not add an automated browser test runner. The live flow was
  verified with real HTTP requests, and the manual UI checklist below covers
  browser verification.

## How to test the complete Phase 5 and Phase 6 flow

Start MongoDB, then run the two dev servers:

```powershell
cd server
npm.cmd run dev

cd ..\client
npm.cmd run dev
```

Open `http://localhost:5173`. Use fresh email addresses for each account.

1. **Create seller A and a product.** Register at `/register` with **Seller**
   selected. At `/seller`, save a store, then add a product with stock `5`.
   Use a public `https://` image URL and note the product name and price.
2. **Create a second seller.** Register another seller, save another store and
   add a different product. This is needed to prove the one-store cart rule.
3. **Create a customer.** Register with **Customer** selected, then open
   `/marketplace`.
4. **Build the cart.** Add seller A's product from its card or detail page.
   Open `/cart`, increase the quantity, then try to add seller B's product. The
   cart must show an error and keep the original store's item.
5. **Prove cart persistence.** Sign out and sign back in as the customer. Open
   `/cart`; the item and quantity must still be there.
6. **Checkout.** Open `/checkout`, fill the delivery contact and address, and
   use **Calculate delivery estimate**.
   - With both Google keys configured, the route map, road distance, drive time
     and fee appear. The total includes delivery and the server recalculates it
     when the order is placed.
   - Without keys, the page shows an explicit pending/unavailable state and the
     order is saved with `deliveryFeeStatus: pending_maps_integration`.
   - An address that Google cannot route blocks the order until it is corrected.
   The cart becomes empty and the order detail page opens.
7. **Check the store pin.** In the seller dashboard, store profile now shows
   latitude/longitude, an optional **Use current location** button and a map
   preview. The pin is public. Clearing both fields removes it.
8. **Check inventory.** As seller A, open `/seller/orders`. The order appears
   with the customer's name, phone, city/state/postal code and items, but no
   street address. When a route was calculated, the seller sees road
   distance/duration and the fee, never customer coordinates or the polyline. In
   the seller dashboard, product stock must already be lower by the ordered
   quantity.
9. **Move the order.** As seller A, use the action buttons to move the order to
   `confirmed`, `preparing`, `ready_for_pickup` and `delivered`. As the customer,
   refresh `/orders` and `/orders/:id` to see the same status, fee and history.
10. **Test cancellation and stock restore.** Place a second order for a product
    with known stock, then cancel it as the seller from `pending` or `confirmed`.
    The customer sees `cancelled`; the seller dashboard stock returns to its
    previous value and the seller order shows stock restored.
11. **Inspect MongoDB.** Connect Compass to `mongodb://127.0.0.1:27017` and open
    `nearkart`. Check `orders` for item snapshots, full customer address,
    `statusHistory`, unique `idempotencyKey`, and — when a route succeeded —
    `deliveryRoute` and `deliveryAddress.location`. Check `products.stock` and
    that the customer's `carts` document is gone after checkout.
12. **Prove duplicate protection at the API.** A browser checkout reuses one
    idempotency key across retries. To prove it directly, send the same
    `POST /api/orders` body with the same `idempotencyKey` twice using a
    customer session. Both responses refer to one order and stock is deducted
    only once.
13. **Prove quote security at the API.** Call `POST /api/delivery/quote` without
    a cart (`409 CART_EMPTY`), as a seller (`403`) and without a session (`401`).
    The endpoint accepts only `deliveryAddress`; the store comes from the
    server-side cart.

If the API reports `INSUFFICIENT_STOCK`, `PRICE_CHANGED` or
`PRODUCT_UNAVAILABLE`, the order was not created; review `/cart` and try again.
If it reports `CART_STORE_CONFLICT`, clear the cart before switching stores.
`DELIVERY_QUOTE_UNAVAILABLE` and `DELIVERY_OUT_OF_RANGE` mean the address or
route must change before checkout.

## Next steps — Phase 7 (not started)

Phase 6 is complete and Phase 7 has not been started. The next phase requires
explicit approval.

A sensible next phase is realtime delivery tracking:

- Authenticate Socket.IO connections with the same session cookie as HTTP and
  join rooms only after server-side authorization.
- Assign orders to drivers, with driver equipment and delivery statuses.
- Share throttled driver GPS updates only with the customer on that active order
  and with admins; stop sharing when the delivery ends.
- Tests for delivery authorization, location privacy, throttling and delivery
  completion.

Google Maps/Routes credentials still need to be configured and the real route
success path re-verified before claiming live maps work. Payments, reviews,
favourites and admin moderation remain separate future phases. Do not treat any
of them as approved by this status update.
