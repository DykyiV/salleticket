# Asol BUS

Bus ticket marketplace (Grandes Tour style) built with **Next.js (App Router)**, **TypeScript** and **Tailwind CSS**.

This is the frontend-only scaffold — no backend yet.

## Stack

- Next.js 14 (App Router) + Edge middleware
- React 18
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
  booking/page.tsx        Passenger details + confirmation
  api/
    search/route.ts       GET/POST /api/search  (carrier registry)
    booking/route.ts      POST/GET /api/booking (in-memory store)
components/
  Header.tsx              Sticky header with "Asol BUS" logo
  SearchForm.tsx          From / To / Date + Search
  TripCard.tsx            Ticket-style result card
  BookingForm.tsx         Passenger form + POST /api/booking
lib/
  db.ts                   Prisma client singleton
  mockTrips.ts            Fake trip data generator
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
middleware.ts              Edge middleware: role-based route protection
prisma/
  schema.prisma           User / Ticket / Booking / Carrier / Trip + enums
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
- `/account` — protected by middleware; shows email, role badge, and role-aware links.
- `/admin`, `/agent` — role-gated dashboards.

### Role hierarchy

`USER < AGENT < ADMIN < SUPER_ADMIN`. See `lib/auth/constants.ts` (`ROLE_RANK`, `hasRoleAtLeast`).

### Middleware

`middleware.ts` runs at the Edge and guards these prefixes (configured via
`matcher`, so public routes pay zero overhead):

| Path            | Required role | Unauth / under-privileged |
|-----------------|---------------|---------------------------|
| `/booking/**`   | `USER`        | redirect → `/login?next=…` |
| `/account/**`   | `USER`        | redirect → `/login?next=…` / `/?error=forbidden` |
| `/agent/**`     | `AGENT`       | redirect as above |
| `/admin/**`     | `ADMIN`       | redirect as above |
| `/api/agent/**` | `AGENT`       | `401` / `403` JSON |
| `/api/admin/**` | `ADMIN`       | `401` / `403` JSON |

`POST /api/booking` additionally calls `requireAuth()` inside its handler so
it returns `401` JSON rather than a redirect when called without a session.

The middleware verifies the JWT with `jose` and forwards identity as request
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

### `GET /api/search?from=Kyiv&to=Lviv&date=2026-05-01`
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

## Adding a new carrier integration

1. Create `lib/carriers/<carrier>/index.ts` and implement the `CarrierAdapter` interface from `lib/carriers/types.ts`:
   - `id`, `name`
   - `search(query): Promise<Trip[]>`
   - `book(request): Promise<{ carrierReference, status, confirmedTrip }>`
2. Register the adapter in `lib/carriers/registry.ts`.
3. The `/api/search`, `/api/booking`, and `/results` pages will start using it automatically.

The booking store in `lib/bookings/store.ts` is in-memory — swap it for a real database before production.

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

## Notes

The old `pages/` directory is removed — the project fully uses the App Router
(`app/` directory). UI is responsive and mobile-first.
