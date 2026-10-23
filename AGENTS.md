# AGENTS.md — NearKart development rules

These instructions apply to every change in this repository, by humans and AI
agents alike. Read them before editing code.

## Current scope

- The project is built **one phase at a time**. Implement only the phase the
  user approved. Never jump ahead or scaffold future features "for later".
- Update `docs/PROJECT_STATUS.md` at the end of every phase: what was built,
  how it was verified, and what comes next.
- If a feature needs an external service that is not configured (MongoDB,
  Google Maps, Routes API), make the UI say it is unavailable. Do not invent
  data, distances, GPS movement or successful API responses.

## Fixed technology decisions

- Frontend: React + TypeScript + Vite in `client/`.
- Backend: Node.js + Express + TypeScript in `server/`.
- Database: MongoDB Atlas using the **official `mongodb` Node.js driver**.
- **Do not use Mongoose, MySQL, PostgreSQL, Supabase or NVIDIA tooling.**
- Realtime: Socket.IO. Maps: Google Maps JavaScript API + Google Routes API.
- Keep dependencies minimal. Do not add a package unless the current phase
  needs it; explain why in the commit/status note.

## Project layout

- `client/` and `server/` are independent npm packages with their own
  `package.json`, `tsconfig.json` and lockfile. Do not merge them or add a
  root package that silently coordinates them.
- Backend features live in `server/src/modules/<feature>/` with a router,
  service and zod schemas as they grow. Keep business logic out of routes.
- Frontend features live in `client/src/features/<feature>/`; shared UI lives
  in `client/src/components/`. API calls go through `client/src/api/`.
- `docs/` holds project documentation only.

## Backend conventions

- **ES modules.** Relative imports must end in `.js` (TypeScript NodeNext
  requirement), e.g. `import { env } from './config/env.js'`.
- Environment variables are validated once in `src/config/env.ts`. Add new
  variables to both that schema and `.env.example`.
- Every request body, query and route param is validated with `zod` before use.
  Never spread `req.body` into a database write.
- Error responses use the shape:
  `{ "error": { "code": "SOME_CODE", "message": "Readable message" } }`.
  Never return stack traces or raw database errors to clients.
- Money is stored and calculated as **integer paise** (₹1 = 100). Never use
  floats for prices, fees or totals.
- The client is never trusted for prices, discounts, delivery fees, totals or
  stock. Recalculate from the database at checkout and reject mismatches.
- Enforce authentication, role checks and **record ownership** in the service
  layer (`{ _id, ownerId: req.user.id }`), not only by hiding UI.
- Use MongoDB transactions for multi-document writes such as checkout and
  stock changes. Atlas is a replica set, so transactions are available.
- Never log passwords, session tokens, full addresses, coordinates or API keys.

## Frontend conventions

- Only `VITE_`-prefixed variables may be used in client code. Those are public.
  Server secrets (MongoDB URI, Google Routes key) must never reach `client/`.
- Keep components typed; avoid `any`. Use `import type` for type-only imports
  (`verbatimModuleSyntax` is enabled).
- Use the shared fetch wrapper in `client/src/api/` rather than raw `fetch`
  scattered through components.
- Show real loading, empty, error and offline states. No placeholder prices,
  fake orders, fake drivers or simulated GPS.
- The API base defaults to `/api` and is proxied by Vite in development.

## Realtime conventions (from Phase 7)

- Authenticate Socket.IO connections with the same session cookie as HTTP.
- Join rooms on the server after authorization. Never trust a client-supplied
  room name for private data.
- Driver locations are visible only to the customer on that active order and to
  admins. Stop sharing when the delivery ends.
- Throttle GPS emits and never broadcast to all clients.

## Security and privacy rules

- Passwords: `bcryptjs` (cost 12 or higher). Sessions: random token, only its
  SHA-256 hash stored in MongoDB, delivered in an `httpOnly`, `SameSite=Lax`
  cookie (`Secure` in production).
- Roles are assigned by the server. Never accept a `role` field from a public
  registration body; customer/seller are the only public roles.
- Driver accounts are created by an authenticated admin. Admin accounts are
  created by an existing admin or the one-time `npm run seed:admin` script.
  There are no public driver or admin registration endpoints.
- Rate-limit auth endpoints. Return generic login errors.
- Customers' addresses: owner, assigned driver during an active delivery, and
  admin only. Sellers see city/postal code at most.
- `.env` files and secrets must never be committed. If a key leaks, rotate it.

## Build and verification

Run before calling any phase complete:

```powershell
cd server
npm run typecheck
npm run build

cd ..\client
npm run typecheck
npm run build
```

Then start both dev servers and exercise the feature with real requests. Do not
claim something works without running it. Record the exact result in
`docs/PROJECT_STATUS.md`.

## Definition of done for a phase

1. The approved features work against real services (or clearly report that the
   service is unconfigured).
2. Type-check and production build pass for both packages.
3. Permission and ownership rules are enforced on the server.
4. No secrets, fake data or simulated integrations were added.
5. `docs/PROJECT_STATUS.md` and `README.md` reflect the new commands and status.
