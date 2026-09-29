# Asol BUS

[![CI](https://github.com/DykyiV/salleticket/actions/workflows/ci.yml/badge.svg)](https://github.com/DykyiV/salleticket/actions/workflows/ci.yml)

Ticket marketplace and back office for an international bus operator
(ТзОВ «Грандес Тур»): public search and booking with seat selection, online
or cash payment, a staff cabinet for departures, routes and tickets, and the
money side — agency commissions, monthly carrier settlements and reports.

> **Структура сайту українською** — розділи, логіка і статус реалізації:
> [docs/STRUCTURE.md](docs/STRUCTURE.md).

## Stack

- Next.js 16 (App Router) + `proxy.ts` (the Next 16 name for middleware)
- React 19, TypeScript, Tailwind CSS 3
- Prisma 6 — SQLite locally, Postgres-ready
- JWT sessions via `jose` (HttpOnly `asol_session` cookie) + `bcryptjs`
- `pdf-lib` + `qrcode` for e-tickets, invoices and acts
- Vitest (unit + integration), a Node smoke suite, GitHub Actions CI

## Getting started

```bash
npm install                 # postinstall runs prisma generate
cp .env.example .env        # SQLite + a dev JWT secret
npm run db:push             # create tables in prisma/dev.db
npm run db:seed             # demo data, users, carriers, commissions
npm run dev                 # http://localhost:3000
```

Seeded users (password in brackets — **dev only**):

| Email | Role | Password |
|---|---|---|
| `admin@asolbus.local` | ADMIN | `Admin12345` |
| `manager@asolbus.local` | MANAGER | `Manager12345` |
| `agent@asolbus.local` | AGENT | `Agent12345` |
| `accountant@asolbus.local` | ACCOUNTANT | `Accountant12345` |

> ⚠️ Never deploy with the example `JWT_SECRET` — generate one with
> `openssl rand -base64 48`. For Postgres, switch the datasource provider in
> `prisma/schema.prisma` and point `DATABASE_URL` at your instance.

## Architecture

### Operational model

Sales run on a real timetable rather than ad-hoc trips:

```
RouteTemplate ─┬─ RouteTemplateStop           (a line with its stops)
               └─ Departure ── DepartureStop  (a dated run of that line)
Leg ── VehicleAssignment ── Bus ── SeatZone   (who drives which segment, seat map, price zones)
TransferPoint                                 (connections between lines)
TariffGrid                                    (stop-to-stop prices)
```

Booking still resolves to `Carrier → Trip → Ticket → Booking`, so every
ticket has a single price snapshot, status, history (`TicketHistory`),
optional `Payment`, per-leg seats (`TicketLeg`) and comments.

`TicketStatus`: `RESERVED` (pay the driver) · `AWAITING_PAYMENT` (online,
with a deadline) · `PAID_ONLINE` · `PAID_CASH` · `CANCELLED` · `REFUNDED`.

### Carriers and transport types

`lib/carriers/registry.ts` fans a search out to every adapter in parallel:
`asol` (own fleet, from the timetable), `mock` (bus), `mock-flights`,
`mock-trains`. `?transport=BUS|FLIGHT|TRAIN` narrows the fan-out; the home
page exposes it as tabs. A new integration implements `CarrierAdapter`
(`lib/carriers/types.ts`) and is added to the registry.

### Money

- **Price is computed on the server** from the stored trip / tariff grid,
  age category, seat zone, promo code and online-payment discount; anything
  the client sends is ignored.
- **Commission** (`lib/commission.ts`): a route rule (carrier + from + to)
  wins over the carrier default. The split is frozen on the ticket at
  booking time. The platform's own fleet (`Carrier.isOwnFleet`) has no split.
- **Settlements** (`lib/settlements.ts`): one per third-party carrier per
  month, with invoice and act numbers. The balance follows the payment point
  — online money is ours and we owe the carrier its share, cash money is the
  carrier's and it owes us the commission. Lifecycle `GENERATED → SENT →
  PAID`, every step logged in `SettlementEvent`.
- **Reconciliation** (`lib/finance/reconciliation.ts`, page
  `/cabinet/finance/reconciliation`): per carrier and per sales agent —
  accrued (carrier settlement balances; agent reward = % of the agent's paid
  sales, frozen on the ticket as `agentRewardPercent`, minus passengers'
  cash the agent took and still holds), paid (recorded
  `CounterpartyPayment`s, partial allowed) and the open balance. Marking a
  settlement paid records the uncovered remainder, capped by the carrier's
  open balance so nothing is counted twice.
- **Cash held by agents**: marking a ticket «Оплачено готівкою» asks who
  took the money — «Готівку отримав я» (agent / cash desk, stored as
  `Ticket.cashCollectedById`) or «Готівка водію в автобусі». Cash taken by
  our agent is agency money for the carrier settlement (we owe the carrier
  its share) and a debt of the agent until it is handed in («+ Платіж →
  Агент здав нам готівку»). Agents default to «я» when the API gets no
  choice (`cashCollector: "ME" | "CARRIER"`), other staff to the driver.
- **Auto-reports** (`lib/finance/autoReports.ts`, page
  `/cabinet/finance/auto-reports`): per carrier / agent — send or not, day of
  month (1–28), e-mail, agent reward %. `.github/workflows/settlements.yml`
  calls `POST /api/cron/auto-reports` (Bearer `CRON_SECRET`) daily; due rows
  get last month's report once per period. Ships **off** behind a global
  switch; mail delivery is a stub (`lib/finance/mailer.ts`) until a provider
  is configured. The workflow is skipped until `APP_URL` / `CRON_SECRET` are
  set.

### Roles and permissions

`CUSTOMER < PARTNER < DRIVER < DISPATCHER < CALL_CENTER < ACCOUNTANT < AGENT
< MANAGER < ADMIN < SUPER_ADMIN` (`lib/auth/constants.ts`).

Two layers:

1. **`proxy.ts`** — coarse role-rank gates by path: `/api/admin/**` ADMIN,
   `/api/agent/**` AGENT, `/api/account/**` any signed-in user;
   `/cabinet/{routes,settings,reports,stats}` ADMIN, `/cabinet/departures`
   AGENT, the rest of `/cabinet` any signed-in user.
2. **Permission matrix** (`lib/auth/permissions.ts`, editable in
   *Налаштування*): `booking.*`, `passenger.*`, `payment.*`, `price.*`,
   `route.*`, `finance.read`, `finance.edit`. An explicit row wins; a missing
   row falls back to the role's defaults; ADMIN+ always passes. Finance is
   permission-gated rather than rank-gated because ACCOUNTANT ranks below
   AGENT but must see money while agents must not.

## Staff cabinet (`/cabinet`)

| Section | Path | Who |
|---|---|---|
| Квитки — list, filters, bulk PDF / SMS, detail with history & comments | `/cabinet/tickets` | everyone (own tickets); staff see all |
| Виїзди — departures, passengers, ops | `/cabinet/departures` | AGENT+ |
| Автобуси, Сканер квитків | `/cabinet/buses`, `/cabinet/scan` | ADMIN / DRIVER+ |
| Маршрути шаблони | `/cabinet/routes` | ADMIN |
| Налаштування — site settings, permission matrix, tariffs | `/cabinet/settings` | ADMIN |
| Звіти, Dashboard | `/cabinet/reports`, `/cabinet/stats` | ADMIN |
| **Фінанси** — settlements, reconciliation + payments, carrier report, commissions, auto-reports, CSV | `/cabinet/finance` | `finance.read` (ACCOUNTANT, MANAGER, ADMIN) |

Old `/admin/*`, `/account` and `/agent` links redirect into the cabinet.

## API overview

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/{register,login,logout}`, `GET /api/auth/me` |
| Search | `GET /api/search?from&to&date&passengers&transport` |
| Seats | `GET /api/trips/[id]/seats`, `POST/DELETE /api/trips/[id]/holds` |
| Booking | `POST /api/booking` (auth; `passengers[]` or legacy `passenger`), `GET /api/booking[?reference=]` |
| Payment | `/api/payments/[reference]/{pay,status}`, page `/pay/[reference]` |
| Own ticket | `/api/account/tickets/[id]/{passenger,status,seat,return,trip,price-recalc,comments}` |
| Documents | `GET /api/tickets/[reference]/pdf` (owner or AGENT+), `GET /api/tickets/bulk-pdf?ids=` (AGENT+, ≤100), `GET /api/tickets/[reference]/wallet`, public check `/check/[reference]` |
| Finance | `/api/finance/settlements` (+ `[id]/{invoice,act,send,pay}`), `/api/finance/reconciliation` (+ `/csv`), `/api/finance/payments` (+ `[id]`), `/api/finance/auto-reports`, `/api/finance/commissions`, `/api/finance/carrier-report/csv` — `finance.read` / `finance.edit` |
| Admin | `/api/admin/*` (users, permissions, routes, departures, buses, tariffs, discounts, settings, `sms`) — ADMIN |
| Cron | `POST /api/cron/auto-reports` (daily), `POST /api/cron/settlements` (all carriers at once) — Bearer `CRON_SECRET` |

CSV exports use a UTF-8 BOM, `;` and CRLF so Excel in Ukrainian/EU locales
opens Cyrillic correctly, and prefix formula-like cells with `'` (CSV
injection).

## Scripts and tests

| Command | What |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint 9 (flat config) |
| `npm test` | Vitest — unit + integration against `/tmp/asol-test.db` |
| `npm run test:smoke` | ~58 HTTP checks against a running server (`BASE_URL`, default `:3100`) |
| `npm run db:push` / `db:seed` / `db:studio` | Prisma |

CI (`.github/workflows/ci.yml`, every PR and push to `main`): install → db
push + seed → lint → type check → vitest → build → start → smoke tests.

The smoke suite covers search per transport type, auth, server-side pricing
against a tampered client price, seat choice, passenger edit, comments, PDF,
cancellation, and the permission boundaries: customer and agent get `403` on
finance, the accountant gets settlements and the CSV, bulk PDF is AGENT+,
SMS is ADMIN-only.

## Known advisories

`npm audit` reports advisories only in the Prisma CLI toolchain (dev-time
config loader). The suggested fix is a downgrade, so it is deferred until a
patched stable Prisma release.
