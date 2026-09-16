# Asol BUS

[![CI](https://github.com/DykyiV/salleticket/actions/workflows/ci.yml/badge.svg)](https://github.com/DykyiV/salleticket/actions/workflows/ci.yml)

Bus ticket marketplace (Grandes Tour style) built with **Next.js (App Router)**, **TypeScript** and **Tailwind CSS**.

Full-stack app: Next.js API routes + Prisma (SQLite locally, Postgres-ready) handle
search, booking, auth, promo codes, and admin/agent dashboards. Trip data currently
comes from a mock carrier adapter — see "Adding a new carrier integration" below.

## Stack

- Next.js 16 (App Router) + Edge proxy (formerly "middleware")
- React 19
- TypeScript
- Tailwind CSS 3
- Prisma ORM 6 (SQLite by default for local dev; swap the datasource to Postgres for production)
- JWT auth via `jose` (Edge-compatible) + `bcryptjs` for password hashing

## Project structure

```
app/
  layout.tsx              Root layout
  page.tsx                Homepage (hero + search block + features)
  globals.css             Tailwind entry
  results/page.tsx        Trip results list
  booking/page.tsx        Booking flow (seat selection → passenger form → confirmation)
  login|register/page.tsx Auth pages
  account/page.tsx        User account (protected)
  admin/ + agent/         Role-gated dashboards (incl. promo/discount management)
  api/
    search/route.ts       GET/POST /api/search  (carrier registry)
    booking/route.ts      POST/GET /api/booking (persisted via Prisma)
    auth/*                register / login / logout / me
    promo/check/route.ts  GET — live promo-code validation
    admin/*               users, bookings, discounts (ADMIN-only)
components/
  Header.tsx              Sticky header with "Asol BUS" logo
  SearchForm.tsx          From / To / Date + Search
  TripCard.tsx            Ticket-style result card
  BookingFlow.tsx         Multi-step booking wizard
  SeatMap.tsx             Interactive seat selection
  BookingForm.tsx         Passenger form + POST /api/booking
  AuthForm.tsx            Shared login/register form
  admin/DiscountsAdmin.tsx Promo/discount management UI
lib/
  db.ts                   Prisma client singleton
  mockTrips.ts            Fake trip data generator
  pricing.ts              Age-category discounts + promo price computation
  promo.ts                Promo validation rules
  seats.ts                Seat map helpers
  carriers/
    types.ts              CarrierAdapter + Booking types
    registry.ts           Parallel fan-out across adapters
    mock/index.ts         MockCarrierAdapter
  auth/
    constants.ts          SESSION_COOKIE, ROLE_RANK, hasRoleAtLeast
    password.ts           bcryptjs hash / verify
    jwt.ts                jose sign / verify (Edge-compatible)
    session.ts            cookie helpers, getSession, getCurrentUser
    guard.ts              requireRole / requireAuth
  tickets/
    service.ts            Ticket operations
    history.ts            Audit trail for ticket/booking changes
proxy.ts                   Edge proxy (route protection, formerly middleware.ts)
prisma/
  schema.prisma           User / Ticket / Booking / Carrier / Trip / Promo + enums
  seed.ts                 Seeds promo codes (DISCOUNT10, VIP20)
```

## Database schema

```
User (id, email, password, role: USER|AGENT|ADMIN|SUPER_ADMIN, createdAt) 1 ── * Ticket
Trip (id, fromCity, toCity, departureTime, arrivalTime, price, carrierId) 1 ── * Ticket
Carrier (id, name, rating)                                                1 ── * Trip
Ticket (id, userId, tripId?, status, price, createdAt)                    1 ── 1 Booking
Booking (id, ticketId, passengerName, phone)
```

`TicketStatus` enum: `RESERVED`, `PAID_ONLINE`, `PAID_CASH`, `CANCELLED`, `REFUNDED`.

Bookings are persisted via Prisma (SQLite locally, file at `prisma/dev.db`).
`/api/search` currently returns mock trips from `MockCarrierAdapter`; real
carriers can be plugged in via `lib/carriers/registry.ts` and `/api/search`
will aggregate across all of them.

## Authentication & authorization

JWT-based auth using `jose` (Edge-compatible) and `bcryptjs` for password
hashing. Sessions are stored in an **HttpOnly, SameSite=Lax** cookie named
`asol_session` (7-day TTL).

### API routes

- `POST /api/auth/register` — `{ email, password }` (min 8 chars). Creates a
  `USER`, sets the session cookie. `409` if email taken.
- `POST /api/auth/login` — `{ email, password }`. Generic `401` on failure.
- `POST /api/auth/logout` — clears the session cookie.
- `GET  /api/auth/me` — `{ user }` or `{ user: null }`.
- `GET/PATCH /api/admin/users` — example ADMIN-only route. `PATCH` assigning
  `ADMIN` / `SUPER_ADMIN` requires SUPER_ADMIN.

### UI pages

- `/login` and `/register` — AuthForm with validation + redirect to `?next=…`.
- `/account` — protected by the Edge proxy; shows email, role badge, and role-aware links.
- `/admin`, `/agent` — role-gated dashboards.

### Role hierarchy

`USER < AGENT < ADMIN < SUPER_ADMIN`. See `lib/auth/constants.ts` (`ROLE_RANK`, `hasRoleAtLeast`).

### Edge proxy (route protection)

`proxy.ts` runs at the Edge and guards these prefixes (configured via
`matcher`, so public routes pay zero overhead):

| Path            | Required role | Unauth / under-privileged |
|-----------------|---------------|---------------------------|
| `/account/**`   | `USER`        | redirect → `/login?next=…` / `/?error=forbidden` |
| `/agent/**`     | `AGENT`       | redirect as above |
| `/admin/**`     | `ADMIN`       | redirect as above |
| `/api/agent/**` | `AGENT`       | `401` / `403` JSON |
| `/api/admin/**` | `ADMIN`       | `401` / `403` JSON |

`/booking` is intentionally **public** so guests can fill the form; the actual
booking creation (`POST /api/booking`) calls `requireAuth()` inside its handler
and returns `401` JSON without a session — the client then redirects to
`/login?next=…` so users sign in before the booking is created.

The proxy verifies the JWT with `jose` and forwards identity as request
headers (`x-user-id`, `x-user-email`, `x-user-role`) to downstream handlers.

### Route-handler guard

For fine-grained checks inside route handlers:

```ts
import { requireRole } from "@/lib/auth/guard";

const guard = await requireRole("ADMIN");
if (!guard.ok) return guard.response;
const { session } = guard;
```

### Env

```
JWT_SECRET="openssl rand -base64 48"
```

The CLI tip actually works:

```bash
openssl rand -base64 48
```

## API

### `GET /api/search?from=Kyiv&to=Lviv&date=2026-05-01&transport=BUS`
Fans out across every registered `CarrierAdapter` in parallel and returns:

```jsonc
{
  "query":   { "from": "Kyiv", "to": "Lviv", "date": "2026-05-01", "passengers": 1 },
  "carriers": [{ "id": "mock", "name": "Asol Mock Network", "tripCount": 6 }],
  "trips":    [ /* Trip[] */ ],
  "errors":   [],
  "meta":     { "total": 6, "cheapest": 15.9 }
}
```

Failures in any single carrier are isolated and reported in `carriers[].error` / `errors[]`.

The optional `transport` parameter (`BUS` | `FLIGHT` | `TRAIN`) narrows the
fan-out to carriers of that transport type; omit it to search across all of
them. The homepage search form exposes the same choice as Bus / Flight /
Train tabs above the From/To fields.

### `POST /api/booking`

**Requires authentication.** The booking is persisted via Prisma inside a
single transaction that:

1. Upserts a `Carrier` by name.
2. Creates a `Trip` row from the trip snapshot (departure/arrival combined with the booking `date`).
3. Creates a `Ticket` owned by the authenticated user with status `RESERVED`.
4. Creates a linked `Booking` with a generated `reference` (e.g. `AB-7K3X9P`).

```jsonc
{
  "tripId":    "mock-trip-2",
  "carrierId": "mock",
  "passenger": { "name": "John Doe", "phone": "+380991234567", "email": "a@b.c" },
  "tripSnapshot": {
    "carrier":   "Grandes Tour",
    "from":      "Kyiv",
    "to":        "Lviv",
    "departure": "08:00",
    "arrival":   "14:50",
    "price":     22,
    "currency":  "EUR",
    "date":      "2026-05-01"
  }
}
```

Returns `201` with `{ booking, carrierReference, fees }`.
- `GET /api/booking?reference=AB-XXXXXX` — returns a single booking (owner or admin only).
- `GET /api/booking` — lists the caller's bookings (admins get all).

At booking time the agency commission is snapshotted onto the ticket
(`commissionPercent` / `commissionAmount` / `carrierAmount`) — see the next
section.

## Carrier commissions & monthly settlements

Every ticket sale is split between the agency and the carrier:

- **Commission resolution** (`lib/commission.ts`): a route-specific
  `CommissionRule` (carrier + fromCity + toCity) wins; otherwise the carrier's
  default `commissionPercent` applies. The split is stored on the ticket at
  booking time, so editing rules never rewrites history.
- **Sales report**: `GET /api/admin/settlements?period=YYYY-MM` (ADMIN) and
  the `/admin/settlements` page show, per carrier: tickets sold, gross sales,
  our commission and the carrier payout — e.g. 10 tickets for €1000 at a 20%
  commission → €200 stays with us, €800 is payable to the carrier.
- **Settlement generation**: `POST /api/admin/settlements { "period" }`
  creates one `Settlement` per carrier (idempotent per carrier+period),
  assigns sequential invoice (`INV-YYYY-MM-NNNN`) and act (`ACT-…`) numbers,
  and locks the included tickets. Legacy tickets without a commission
  snapshot are backfilled from the current rules at generation time.
- **Documents**: `GET /api/admin/settlements/[id]/invoice` and `…/act`
  render printable Ukrainian рахунок-фактура / акт наданих послуг (HTML).
- **Automatic monthly run**: `.github/workflows/settlements.yml` fires on the
  7th of each month (06:17 UTC) and calls `POST /api/cron/settlements` with
  `Authorization: Bearer $CRON_SECRET`, which generates settlements for the
  previous month and marks them SENT. Configure the `APP_URL` repository
  variable and the `CRON_SECRET` repository secret (and the same
  `CRON_SECRET` in the app's environment) to enable it.
  Email delivery is a deliberate stub — wire SMTP/transactional email in
  `markSettlementSent` (`lib/settlements.ts`) when credentials exist.

Seed data (`npm run db:seed`) includes sample carriers with default
commissions (8–15%) and a route rule (Grandes Tour, Kyiv → Lviv: 20%).

## Adding a new carrier integration

1. Create `lib/carriers/<carrier>/index.ts` and implement the `CarrierAdapter` interface from `lib/carriers/types.ts`:
   - `id`, `name`
   - `search(query): Promise<Trip[]>`
   - `book(request): Promise<{ carrierReference, status, confirmedTrip }>`
2. Register the adapter in `lib/carriers/registry.ts`.
3. The `/api/search`, `/api/booking`, and `/results` pages will start using it automatically.

Bookings are persisted in the database (Prisma transaction creating Carrier →
Trip → Ticket → Booking). For production, switch the datasource to Postgres and
wire a real payment + carrier adapter before taking money.

## Getting started

### 1. Install dependencies

```bash
npm install
```

`postinstall` runs `prisma generate`, so the Prisma client is ready immediately.

### 2. Configure `.env`

Copy the template:

```bash
cp .env.example .env
```

Defaults use SQLite and a local dev JWT secret:

```
DATABASE_URL="file:./dev.db"
JWT_SECRET="super-secret-key-12345"
```

> ⚠️ **Never deploy with the example `JWT_SECRET`.** Generate a strong one with
> `openssl rand -base64 48` and keep it out of version control.

The SQLite file will be created at `prisma/dev.db` on first push / migrate.

To run against Postgres instead, switch `datasource db { provider = ... }`
in `prisma/schema.prisma` to `"postgresql"` and point `DATABASE_URL` at your
Postgres instance (e.g. `postgresql://postgres:postgres@localhost:5432/asol_bus?schema=public`).

### 3. Apply the schema

```bash
npm run db:push         # fastest: writes tables into prisma/dev.db
# or, for tracked migrations:
npm run db:migrate
```

Useful helpers:

- `npm run db:generate` — regenerate the Prisma client
- `npm run db:studio` — open Prisma Studio

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — lint the project
- `npm run test:smoke` — run the API smoke tests (needs a running server)

## Testing

`scripts/smoke-test.mjs` runs 18 end-to-end checks against a running
production server: public pages, trip search, registration/login/logout,
promo-code validation, booking creation (including client price-tampering
protection and discount math), booking listing, and role-based route
protection.

```bash
npm run build
npm run start -- -p 3100 &   # serve the production build
npm run test:smoke           # 18 checks, exits non-zero on failure
```

The same suite runs in CI (`.github/workflows/ci.yml`) on every push and
pull request to `main`, after lint and build.

## Notes

The old `pages/` directory is removed — the project fully uses the App Router
(`app/` directory). UI is responsive and mobile-first.

## Known security advisories (npm audit)

After the Next.js 16 upgrade, `npm audit` reports only 3 remaining advisories,
all in the Prisma CLI toolchain:

| Package | Severity | Why it stays |
|---------|----------|--------------|
| `prisma` / `@prisma/config` / `deepmerge-ts` | high | Advisory affects the Prisma CLI's config loader (dev-time only, not shipped to production). The npm-suggested "fix" is a *downgrade* to prisma@6.12.0, which loses newer patches — not worth it. Revisit when a patched stable release lands. |

The previous `next` / `postcss` advisories were resolved by upgrading to
Next.js 16 (+ React 19) and `postcss` ^8.5.28.
