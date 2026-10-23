# NearKart

A local marketplace where small businesses list products, manage stock and
receive orders, and customers discover and buy from stores near them.

Built by **CodeBreakers**: Shalina Maniyar, Niyati Gogri, Vaibhavi Prabhu,
Abhijith.

> **Current status: Phase 6 — Google Maps locations and delivery estimates.**
> Working: landing page, API health, local MongoDB connection, database
> indexes, authentication and roles, seller store profiles and map pins,
> product CRUD and stock, the public marketplace, product detail pages,
> server-side cart, server-recalculated checkout, inventory reservation,
> customer order history, the seller order queue, Google Routes road
> distance/duration, configurable integer-paise delivery fees and map/route
> display. Payments, realtime driver GPS and admin moderation are **not built
> yet**.

## Stack

| Layer    | Technology                                          |
| -------- | --------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, React Router            |
| Backend  | Node.js, Express 5, TypeScript                      |
| Database | MongoDB (local server) + official `mongodb` driver  |
| Realtime | Socket.IO (later phases)                            |
| Maps     | Google Maps JS API + Google Routes API (Phase 6)    |

No Mongoose. No MySQL, PostgreSQL or Supabase.

## Project structure

```
e-commerce/
├─ client/                  React + Vite frontend (independent package)
│  └─ src/
│     ├─ api/               fetch wrapper, auth, store and product calls
│     ├─ auth/              AuthProvider (session restore, login/logout)
│     ├─ components/        header, footer, guards, icons, product image
│     ├─ features/          marketplace, cart, orders and seller workspaces
│     ├─ hooks/             reusable hooks
│     ├─ lib/               money helpers (integer paise ↔ rupee input)
│     ├─ pages/             landing, login, register, account, 404
│     └─ styles/            design tokens + page styles
├─ server/                  Express + TypeScript API (independent package)
│  ├─ tests/                Node test runner + supertest API tests
│  └─ src/
│     ├─ config/            validated environment
│     ├─ db/                MongoClient pool, indexes, collections
│     ├─ lib/               app errors, ObjectId and Mongo error helpers
│     ├─ middleware/        auth, role checks, validation, errors
│     ├─ modules/auth/      routes, schemas, service, token/password utils
│     ├─ modules/health/    GET /api/health
│     ├─ modules/store/     seller store profiles
│     ├─ modules/product/   seller CRUD + public marketplace queries
│     ├─ modules/cart/      authenticated cart, stock checks, schemas
│     ├─ modules/delivery/  Google Routes quotes + integer-paise pricing
│     ├─ modules/order/     checkout, inventory, histories, seller fulfilment
│     ├─ scripts/           one-time admin bootstrap
│     ├─ app.ts             Express wiring
│     └─ index.ts           DB connect → indexes → listen
├─ docs/PROJECT_STATUS.md   progress, verification, next steps
├─ AGENTS.md                rules for changing this repo
└─ README.md
```

## Prerequisites

- **Node.js 20.19 or newer** (tested on Node 24)
- **MongoDB running locally** on `127.0.0.1:27017` (Compass can connect to the
  same server)
- npm and Git

## Install

From the project root:

```powershell
cd server
npm install

cd ..\client
npm install
```

## Environment

`server/.env` is gitignored. Start from the example:

```powershell
cd server
Copy-Item .env.example .env
```

Defaults that work locally:

```env
NODE_ENV=development
PORT=4000
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=nearkart
SESSION_COOKIE_NAME=nk_session
BCRYPT_SALT_ROUNDS=12
AUTH_RATE_LIMIT_MAX=20

# Optional in Phase 6: server-only Routes API key + integer-paise pricing
GOOGLE_MAPS_API_KEY=
GOOGLE_MAPS_REQUEST_TIMEOUT_MS=8000
DELIVERY_BASE_FEE_PAISE=2000
DELIVERY_PER_KM_PAISE=800
DELIVERY_PER_MINUTE_PAISE=0
DELIVERY_MIN_FEE_PAISE=2000
DELIVERY_MAX_DISTANCE_METERS=25000
```

- Only `VITE_`-prefixed values may appear in `client/.env`; they are public.
- Never put `MONGODB_URI` (if it contains a password) or any server secret in
  the client.
- `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` are used **only** by the
  one-time seed script. Remove the password after creating the first admin.
- Without `GOOGLE_MAPS_API_KEY`, delivery estimates are explicitly
  **pending**, not invented.

### Google Maps keys (Phase 6)

Two different keys are used on purpose:

| Where | Variable | Enable | Restrict |
| --- | --- | --- | --- |
| `server/.env` | `GOOGLE_MAPS_API_KEY` | **Routes API** only | server IP / API restriction; never exposed |
| `client/.env` | `VITE_GOOGLE_MAPS_API_KEY` | **Maps JavaScript API** only | HTTP referrers such as `http://localhost:5173/*` and the production domain |

Create `client/.env` when you have a browser key:

```powershell
cd client
Copy-Item .env.example .env
# then set VITE_GOOGLE_MAPS_API_KEY=...
```

The browser key must **not** have Routes API permission, and the server key must
never be placed in a `VITE_` variable. If either key is missing, the UI says the
map or estimate is unavailable instead of showing a fake route or fee.

## Run (two terminals)

**Terminal 1 — backend**

```powershell
cd server
npm run dev
```

Expected:

```
[nearkart-api] Connected to MongoDB (local)
[nearkart-api] Database initialized (collections/indexes ensured)
[nearkart-api] listening on http://localhost:4000 (development)
```

**Terminal 2 — frontend**

```powershell
cd client
npm run dev
```

Open http://localhost:5173. The header badge shows **API · DB online** only
when both the API and the MongoDB ping succeed.

## Create the first admin (secure, one time)

1. In `server/.env`, set:

   ```env
   ADMIN_NAME=Your Name
   ADMIN_EMAIL=you@example.com
   ADMIN_PASSWORD=a-strong-password-at-least-12-chars
   ```

2. Run:

   ```powershell
   cd server
   npm run seed:admin
   ```

3. **Remove `ADMIN_PASSWORD` from `.env` afterwards.** The password is stored
   only as a bcrypt hash, and the script prints the email, never the password.
   Running it again with the same email makes no changes.

There is no public admin registration page or endpoint.

## API endpoints

| Method | Path                                  | Access        | Purpose                          |
| ------ | ------------------------------------- | ------------- | -------------------------------- |
| GET    | `/api/health`                         | public        | Backend + database status        |
| POST   | `/api/auth/register/customer`         | public        | Create customer + session        |
| POST   | `/api/auth/register/seller`           | public        | Create seller + session          |
| POST   | `/api/auth/login`                     | public        | Start a session                  |
| POST   | `/api/auth/logout`                    | signed in     | Revoke current session           |
| GET    | `/api/auth/me`                        | signed in     | Current user                     |
| POST   | `/api/auth/admin/drivers`             | admin only    | Create a driver account          |
| POST   | `/api/auth/admin/admins`              | admin only    | Create another admin account     |
| GET    | `/api/stores/me`                      | seller        | Current seller store (or null)   |
| POST   | `/api/stores`                         | seller        | Create the seller's store        |
| PATCH  | `/api/stores/me`                      | seller        | Update own store profile         |
| GET    | `/api/seller/products`                | seller        | Own products + stock summary     |
| POST   | `/api/seller/products`                | seller        | Create a product in own store    |
| PATCH  | `/api/seller/products/:id`            | seller/owner  | Update an own product            |
| DELETE | `/api/seller/products/:id`            | seller/owner  | Delete an own product            |
| GET    | `/api/products`                       | public        | Search and filter products       |
| GET    | `/api/products/categories`            | public        | Supported category list          |
| GET    | `/api/products/:id`                   | public        | Public product detail            |
| GET    | `/api/cart`                           | customer      | Read own cart                    |
| POST   | `/api/cart/items`                     | customer      | Add a product to the cart        |
| PATCH  | `/api/cart/items/:productId`          | customer      | Change an item's quantity        |
| DELETE | `/api/cart/items/:productId`          | customer      | Remove one cart item             |
| DELETE | `/api/cart`                           | customer      | Clear the cart                   |
| POST   | `/api/delivery/quote`                 | customer      | Route + fee for the cart's store  |
| GET    | `/api/orders`                         | customer      | Own order history                |
| POST   | `/api/orders`                         | customer      | Validate cart, reserve stock, order |
| GET    | `/api/orders/:orderId`                | customer/owner | Own order detail                |
| GET    | `/api/seller/orders`                  | seller        | Orders for the seller's store    |
| GET    | `/api/seller/orders/:orderId`         | seller/owner  | One order from own store         |
| PATCH  | `/api/seller/orders/:orderId/status`  | seller/owner  | Advance or cancel an order       |

Auth responses use `{ "user": { ... } }` and never include `passwordHash`.
The role is chosen by the server route; a `role` field sent by the browser is
ignored.

Product endpoints accept and return integer **paise** (`pricePaise`); the client
converts rupee input once. Seller routes return `403` for customers and enforce
`{ productId, sellerId }` ownership in the service, so seller B cannot edit or
delete seller A's product. Public product responses include the store name and
city, but never seller/store owner ids.

`POST /api/delivery/quote` accepts only `{ deliveryAddress }`. The store is read
from the signed-in customer's cart, never from the body. The server calls Google
Routes with its private key and returns either a `calculated` quote (road
distance, duration, fee in paise, total and encoded route) or an `unavailable`
quote with an explicit `reason`, `checkoutAllowed` flag and readable message.
Order creation repeats the calculation before writing the order.

## How authentication works

- Passwords are hashed with **bcrypt** (`bcryptjs`) at cost 12.
- Login creates a random 32-byte token. MongoDB stores only its SHA-256 hash in
  `sessions`, along with `expiresAt` (7 days, TTL index).
- The raw token lives in an `httpOnly`, `SameSite=Lax` cookie. JavaScript cannot
  read it; `Secure` is added in production.
- `requireAuth` validates the session and loads the user on every protected
  request. `requireRole(...)` enforces roles on the server. A suspended user is
  rejected immediately.
- Login, registration and admin-account creation are rate limited.

## How stores, products and the marketplace work

- A seller saves a store profile first. One store per seller is enforced by a
  unique `stores.ownerId` index and checked again in the service.
- A product stores an `ObjectId` reference to both its `sellerId` and `storeId`,
  plus a fixed category, integer `pricePaise`, stock, low-stock threshold, image
  URL, `isActive` flag and timestamps.
- Sellers can create, edit, pause and delete only their own products. Customers
  and unauthenticated requests receive `403`/`401` from seller routes.
- The public catalogue shows only active products belonging to active stores.
  Out-of-stock products remain visible with an **Out of stock** badge.
- Search matches product names case-insensitively and escapes regular-expression
  characters. Category, min/max price, availability, page and limit are validated
  by zod on the server.
- Product images are external `http(s)` URLs. If one cannot load, the UI renders
  a neutral placeholder instead of a broken image.
- Cart, checkout and order behaviour is described in the next section. Store
  map pins, Google Routes estimates and delivery fees are described in the
  delivery section after it.

## Verify each role (exact steps)

1. **Customer** — open http://localhost:5173/register, keep **Customer**
   selected, register with a new email. You land on `/account` showing role
   `customer`. Sign out, then sign in at `/login` with the same credentials.
2. **Seller** — sign out, open `/register`, choose **Seller**, use a different
   email. The account page shows role `seller`. Sellers cannot create drivers
   or admins (next step proves it).
3. **Admin** — create the first admin with the seed steps above, then sign in
   at `/login`. The account page shows an **Admin only → Create a driver
   account** card.
4. **Driver** — while signed in as admin, fill that card (name, email,
   temporary password ≥ 8 characters) and submit. Sign out and sign in as that
   driver: the account page shows role `driver`, and the admin card is gone.

Prove role enforcement with the API (customer session must get `403`):

```powershell
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-RestMethod -Method Post -Uri http://localhost:5173/api/auth/login `
  -ContentType application/json -WebSession $session `
  -Body '{"email":"YOUR_CUSTOMER_EMAIL","password":"YOUR_PASSWORD"}'

try {
  Invoke-RestMethod -Method Post -Uri http://localhost:5173/api/auth/admin/drivers `
    -ContentType application/json -WebSession $session `
    -Body '{"fullName":"Nope","email":"nope@example.com","password":"NopePass123!"}'
} catch {
  "Status: $([int]$_.Exception.Response.StatusCode)"   # expected: 403
}
```

Also confirm `GET /api/auth/me` returns `401` without a session.

## Open a store and browse the marketplace

1. Sign in as a **seller** and open http://localhost:5173/seller.
2. Save the store profile (name, city, optional description). Optionally add the
   store's latitude/longitude (or use the browser location button) so delivery
   estimates can be calculated. The pin is public, so use the pickup location,
   not a home address. A seller has one store; saving again updates it.
3. Add a product: name, description, category, rupee price, stock, low-stock
   alert level and a public `https://` image URL. The API stores the price as
   integer paise.
4. Open http://localhost:5173/marketplace. The product appears with its store
   name, price, category and availability. Use the search, category, price and
   availability controls to narrow the list.
5. Open a product to see its detail page. Add more products or set stock to `0`
   to see the **Out of stock** state (it stays listed).
6. In `/seller`, use **Edit** to update stock/price, or **Delete** to remove your
   own product after confirmation. Paused listings disappear from the public
   marketplace but remain visible in your dashboard.

The marketplace is empty until a seller saves a store and adds products. That is
expected; no demo products are seeded.

The tests also prove that a second seller receives `404` when trying to edit or
delete the first seller's product, and a customer receives `403` on seller
routes.

## Cart, checkout and order management

- The cart is stored in MongoDB under the signed-in customer, not in
  `localStorage`, so it survives page reloads, sign-out and sign-in. A cart can
  contain products from **one store** at a time in this MVP. Adding a product
  from another store returns `CART_STORE_CONFLICT`.
- Add products from the marketplace cards or product detail pages.
  Unauthenticated visitors are sent to login; seller accounts cannot use the
  customer cart.
- Checkout is customer-only and requires a delivery contact and address. The
  server reloads the cart and every product, recalculates all prices and totals
  from integer paise, checks current stock, and rejects stale prices or
  unavailable products. The browser never supplies a price or total.
- **Calculate delivery estimate** asks the server for a Google Routes quote based
  on the store pin and the address. The map, road distance, drive time and fee
  appear only when the route succeeds. The server repeats the calculation when
  the order is created.
- If Maps or the store pin is not configured, the order is still saved with
  `deliveryFeePaise: 0` and `deliveryFeeStatus: "pending_maps_integration"`, and
  the UI says the fee is pending. Invalid addresses, unroutable addresses, API
  failures and distances over `DELIVERY_MAX_DISTANCE_METERS` block checkout.
- Stock is reserved with atomic conditional updates before the order document is
  written. A failed checkout releases earlier reservations; a duplicate
  idempotency key returns the original order without deducting stock again.
- Orders snapshot the product name, image URL, unit price and quantity at
  purchase time. Later seller edits do not change the order.
- Statuses are `pending → confirmed → preparing → ready_for_pickup → delivered`.
  Sellers may cancel from `pending`, `confirmed` or `preparing`; cancellation
  restores stock. Cancellation after `ready_for_pickup` is blocked.
- Customers see their own orders and full delivery address. Sellers see customer
  name, phone, city, state, postal code and country, but **not** the street
  lines. When a route was calculated, sellers also see road distance, duration
  and fee, but never customer coordinates or the route polyline.
- Delivery fees are calculated on the server from configurable integer-paise
  rules. A missing Maps key or store pin is shown as explicitly pending, never as
  a made-up zero-rupee quote.

### Try the complete flow

1. Register seller A, save a store at `/seller`, and add a product with stock
   `5`.
2. Register seller B, save another store, and add a different product.
3. Register a customer, then add seller A's product from `/marketplace`.
4. Open `/cart`, change the quantity, then try to add seller B's product. The
   cart must reject the second store and keep seller A's item.
5. Sign out and back in as the customer. `/cart` must still show the item.
6. Open `/checkout`, fill the delivery details and click **Calculate delivery
   estimate**. With Maps configured, the map, road distance, drive time and fee
   appear and the total includes delivery; without keys, the estimate is labelled
   pending. Then place the order. The cart empties and the order detail page
   opens with the stored fee status/route.
7. Sign in as seller A and open `/seller/orders`. Confirm, prepare, mark ready
   and deliver the order. Refresh the customer's `/orders` page to see the same
   status history. Seller A can see the customer's contact and area, but not the
   street address.
8. Place a second order with known stock, then cancel it as the seller. Verify
   the product stock returns to its previous value in the seller dashboard.
9. Connect Compass to `mongodb://127.0.0.1:27017` and inspect `nearkart`:
   `orders` should contain the item snapshots, address, status history and a
   unique idempotency key; `products.stock` should reflect successful orders and
   cancellations; the customer's `carts` document should be gone after checkout.
10. To prove duplicate protection, send the same `POST /api/orders` body with
    the same `idempotencyKey` twice using one customer session. Both responses
    refer to one order and stock is deducted once.

If checkout reports `INSUFFICIENT_STOCK`, `PRICE_CHANGED` or
`PRODUCT_UNAVAILABLE`, no order was created. Review `/cart` and retry.
`DELIVERY_QUOTE_UNAVAILABLE` and `DELIVERY_OUT_OF_RANGE` mean the address or
route must be corrected before ordering.

## Maps, Routes and delivery fees

- A seller's store pin is optional and public. Coordinates are validated
  (`-90..90`, `-180..180`), rounded to six decimals and can be cleared by
  leaving both fields blank.
- `POST /api/delivery/quote` is customer-only. It derives the store from the
  server-side cart, joins the address into a Routes API `destination.address`
  request, and asks for a `DRIVE` route with traffic-aware routing.
- The Routes API response supplies road distance, duration, encoded polyline and
  the geocoded destination. The server stores the route snapshot on the order.
- The fee is integer paise:

  ```
  ceil(distanceKm) × DELIVERY_PER_KM_PAISE
  + ceil(durationMinutes) × DELIVERY_PER_MINUTE_PAISE
  + DELIVERY_BASE_FEE_PAISE
  ```

  The result is never lower than `DELIVERY_MIN_FEE_PAISE`. Distances over
  `DELIVERY_MAX_DISTANCE_METERS` are rejected as out of range.
- Failure reasons are explicit: `MAPS_NOT_CONFIGURED`,
  `STORE_LOCATION_MISSING`, `ADDRESS_INVALID`, `ROUTE_NOT_FOUND`,
  `ROUTE_UNAVAILABLE` and `ROUTE_TOO_LONG`. Only the first two allow checkout
  with a pending fee.
- The browser never receives the server Routes key. The Maps JavaScript key is
  only for drawing the map and decoding the polyline returned by the server.

**Current workspace note:** no Maps/Routes credentials are configured, so the
real Google success path is not verified live. It is covered by unit tests with
mocked Routes responses, and the UI/API fallback was verified live. See
`docs/PROJECT_STATUS.md`.

## Tests

The test suite uses the local MongoDB server with a **separate database**
(`nearkart_test`) and drops it before and after the run. It never touches the
`nearkart` database.

```powershell
cd server
npm run test
```

Covers **54 integration tests**: health status, registration, password hashing,
duplicate email, weak password validation, generic login failure, session
restore/logout, missing session, role enforcement, admin-created drivers, no
password-hash leakage, store creation/update, product validation, ObjectId
seller/store references, public listing/search/filters/pagination, invalid ids,
seller ownership isolation, inactive-product visibility, low-stock summary and
seller-only delete.

Phase 5 tests add cart isolation and persistence, cross-store cart rejection,
stock and quantity checks, checkout validation, concurrent oversell prevention,
duplicate idempotency, server-side price and stock rejection, customer order
history, seller order ownership and privacy, allowed status transitions,
cancellation and stock restoration.

Phase 6 tests add integer-paise fee rounding and minimums, blocking/non-blocking
failure classification, a mocked Routes API success (distance, duration,
destination, polyline and request headers/body), every unavailable reason,
customer-only quote access, empty-cart rejection, store coordinate validation and
public serialization, a pending-fee order when Maps is unconfigured, a
server-calculated route/fee persisted on the order with the seller-facing route
summary only, and an unroutable address that blocks checkout without reserving
stock.

The complete customer-to-seller flow was also run live: Phase 5 through the Vite
proxy against temporary `nearkart_phase5_e2e` (two stores, three products, cart
conflict, checkout, duplicate key, stock changes, seller transitions,
cancellation and MongoDB inspection), and Phase 6 against temporary
`nearkart_phase6_e2e` with no Maps key (store pin serialization,
`MAPS_NOT_CONFIGURED` quote, pending-fee order and seller privacy). Both
temporary databases were dropped afterwards. See `docs/PROJECT_STATUS.md` for
exact results and the manual UI checklist.

## Scripts

### server/

| Command              | What it does                                  |
| -------------------- | --------------------------------------------- |
| `npm run dev`        | Start API with auto-reload (`tsx watch`)      |
| `npm run typecheck`  | Type-check without writing files              |
| `npm run build`      | Compile to `server/dist`                      |
| `npm start`          | Run the compiled API                          |
| `npm run test`       | Auth, store, product, cart, order and delivery tests |
| `npm run seed:admin` | Create the first admin from `.env`            |

### client/

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Vite dev server on port 5173                  |
| `npm run typecheck` | Type-check app + `vite.config.ts`             |
| `npm run build`     | Type-check, then build to `client/dist`       |
| `npm run preview`   | Serve the production build locally            |

## Troubleshooting

- **`npm.ps1 cannot be loaded`** — use `npm.cmd` instead of `npm`, or run
  `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.
- **`ECONNREFUSED 127.0.0.1:27017`** — start the local MongoDB service and make
  sure Compass can connect. Check `MONGODB_URI` in `server/.env`.
- **Header says "API online · DB down"** — the API is running but the ping
  failed; check MongoDB, then restart the backend.
- **Badge says "API offline"** — start the backend; the badge checks once per
  page load.
- **Login returns 401** — same generic message for unknown email and wrong
  password by design. Verify the email/password you registered.
- **429 rate limited** — wait 15 minutes or raise `AUTH_RATE_LIMIT_MAX` in
  `server/.env` for local testing.
- **`STORE_REQUIRED` when adding a product** — save the seller's store profile
  first. Products must belong to a store.
- **A product is missing from `/marketplace`** — check that its `isActive` flag
  is on and its store is active. Clear filters or search terms; inactive
  products are hidden from the public catalogue.
- **An image shows a letter instead of a photo** — the seller's image URL failed
  to load. Use a public `http://` or `https://` URL; the fallback is intentional.
- **Product detail says "Product not found"** — the product was deleted, paused,
  or the URL id is wrong. Invalid ids return `400`; missing products return
  `404`.
- **The cart rejects a product from another store** — expected in the current
  MVP. A cart holds one store's products; clear it before switching stores.
- **Checkout says stock, price or availability changed** — no order was created.
  The server rechecks every item. Open `/cart`, review the warning and try again.
- **The map says "Map unavailable"** — `VITE_GOOGLE_MAPS_API_KEY` is missing, or
  Maps JavaScript API is not enabled for that browser key. The rest of checkout
  still works; the map is not faked.
- **The estimate says "Delivery estimates are not available yet"** — the server
  has no `GOOGLE_MAPS_API_KEY`. The order can still be placed with the delivery
  fee explicitly pending. Add the server-only Routes key to change this.
- **The estimate says the store has no map location** — ask the seller to save
  the store latitude/longitude. A quote cannot be calculated without a pickup
  pin.
- **Checkout is blocked with `DELIVERY_QUOTE_UNAVAILABLE` or
  `DELIVERY_OUT_OF_RANGE`** — the address could not be routed, the Routes API
  failed, or the road distance exceeds `DELIVERY_MAX_DISTANCE_METERS`. Correct
  the address or raise the configured limit; no order was created.
- **Google returns `REQUEST_DENIED` / key errors** — check that the server key
  has Routes API enabled and the browser key has Maps JavaScript API enabled and
  the correct referrer restriction. Never swap the two keys.
- **Cookie not saved in production** — cookies are `Secure` when
  `NODE_ENV=production`, so serve the app over HTTPS.
