# Asol BUS

Bus ticket marketplace (Grandes Tour style) built with **Next.js (App Router)**, **TypeScript** and **Tailwind CSS**.

This is the frontend-only scaffold — no backend yet.

## Stack

- Next.js 14 (App Router) + Edge middleware
- React 18
- TypeScript
- Tailwind CSS 3
- PostgreSQL + Prisma ORM 6
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
  bookings/store.ts       In-memory booking store (to be replaced with Prisma)
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

The in-memory booking store in `lib/bookings/store.ts` is the next candidate
to migrate onto Prisma — `POST /api/booking` should create a `Ticket` and
a linked `Booking`, and `/api/search` can later pull real data from the
`Trip`/`Carrier` tables instead of the mock generator.

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
| `/account/**`   | `USER`        | redirect → `/login?next=…` / `/?error=forbidden` |
| `/agent/**`     | `AGENT`       | redirect as above |
| `/admin/**`     | `ADMIN`       | redirect as above |
| `/api/agent/**` | `AGENT`       | `401` / `403` JSON |
| `/api/admin/**` | `ADMIN`       | `401` / `403` JSON |

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

```jsonc
{
  "tripId":    "mock-trip-2",
  "carrierId": "mock",
  "passenger": { "name": "John Doe", "phone": "+380991234567", "email": "a@b.c" },
  "tripSnapshot": { "from": "Kyiv", "to": "Lviv", "departure": "08:00", "arrival": "14:50", "price": 22 }
}
```

Returns `201` with `{ booking, carrierReference, fees }`.
`GET /api/booking?reference=AB-XXXXXX` returns a single booking, `GET /api/booking` lists all.

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

### 2. Start PostgreSQL and configure `.env`

Copy the template and point it at your database:

```bash
cp .env.example .env
```

Quick local Postgres with Docker:

```bash
docker run --name asol-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=asol_bus \
  -p 5432:5432 -d postgres:16
```

Default `DATABASE_URL`:

```
postgresql://postgres:postgres@localhost:5432/asol_bus?schema=public
```

### 3. Apply the schema

```bash
npm run db:migrate      # creates migrations/ and applies them (dev)
# or, for a quick prototype:
npm run db:push         # pushes schema without migrations
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
