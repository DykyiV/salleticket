# Asol BUS — project notes for future work

Bus ticket marketplace: search, seat selection, booking, payments (online +
cash), staff/admin back office, agent commissions, discount cards, referrals,
cancellations/refunds. Next.js App Router + Prisma + SQLite.

Read this before making non-trivial changes — it says what already exists,
why it's shaped the way it is, and what's still a stub waiting for a real
integration. Keep it updated as the project evolves: when you add a
feature, a business rule, or a new integration point, add a line here too.

## Stack & commands

- Next.js 14 (App Router), TypeScript, Tailwind CSS.
- Prisma ORM, SQLite locally (`prisma/dev.db`, gitignored) — swap the
  datasource to Postgres for production by changing `prisma/schema.prisma`'s
  `datasource db { provider = ... }` and `DATABASE_URL`.
- Auth: JWT in an HttpOnly cookie (`jose`, Edge-compatible), `bcryptjs` for
  password hashing. See `lib/auth/`.

```bash
npm install                 # postinstall runs `prisma generate`
cp .env.example .env
npm run db:push             # sync schema to SQLite (dev)
npm run db:seed             # 2-3 example Route templates + promo codes
npm run dev
npm run build && npm start  # production build/run
npx tsc --noEmit            # typecheck — run this after any change
```

There is no ESLint config in this repo (`next lint` prompts interactively) —
don't rely on it in verification steps.

## Domain model

```
Route (template)  ──generates──►  Trip (concrete, dated)  ──has──►  Seat (real inventory)
  │ fromCity/toCity                  │ departureTime                  │ AVAILABLE/BOOKED
  │ daysOfWeek, departureTime        │ price (snapshot from Route)    │ claimed by exactly
  │ basePrice, busCapacity           │                                 one Ticket
  └─ RouteStop[] (ordered)

Ticket ──1:1──► Booking (passenger contact + reference, immutable after creation)
  │ status: RESERVED → PAID_ONLINE|PAID_CASH → CANCELLED|REFUNDED (terminal)
  │ userId (owner) + bookedByUserId (agent, if staff booked it) + refundedByUserId
  │ paymentMethod: ONLINE | CASH_TO_AGENT | CASH_TO_CARRIER
  │ commissionAmount, refundAmount, refundWithheld — money snapshots at the
  │   time they happened, never recomputed later
  └─ TicketHistory[] — full audit trail, see below

User
  │ role: USER < AGENT < ADMIN < SUPER_ADMIN (lib/auth/constants.ts hasRoleAtLeast)
  │ canAccessStaffTickets / canAccessStaffTrips / canMarkPayments / canCancelTickets
  │   — per-agent grants, default false, set by ADMIN on /admin/agents.
  │   ADMIN/SUPER_ADMIN bypass these always (see lib/auth/staffPermissions.ts)
  │ commissionType/commissionValue — this user's rate when they book as staff
  │ referralCode / referredByUserId / referralRewardGranted
  └─ discountCards[], promos[] (bound promo codes)

Promo          — campaign code: %/fixed, time window, usage cap, optional per-user bind.
DiscountCard   — persistent per-customer %, no expiry/cap. Issued manually, or
                 automatically (REFERRAL_WELCOME on signup, REFERRAL_REWARD after
                 the referred friend's first ticket). A booking redeems a Promo
                 OR a DiscountCard, never both (enforced in app/api/booking/route.ts).
RefundPolicy   — singleton row, admin-editable %s for cash/online refunds (default 0.8/0.8).
```

## Where things live

```
lib/carriers/          CarrierAdapter interface + registry + MockCarrierAdapter
                        (id "mock" = "handled in-process", not a real external carrier)
lib/routes/            generate.ts (Route → Trip+Seat), search.ts (DB-backed search,
                        falls back to lib/mockTrips.ts only if no Route exists yet)
lib/payments/gateway.ts  PaymentGateway interface + MockPaymentGateway (see below)
lib/tickets/
  history.ts            recordTicketHistory/diffChanges — the audit trail primitive
  service.ts            updateTicketStatus — generic status transition + audit
  cancel.ts             the RESERVED/PAID_CASH/PAID_ONLINE cancel+refund state machine
lib/auth/
  staffPermissions.ts   hasStaffPermission() — the ADMIN-bypass + AGENT-flag check
  constants.ts          ROLE_RANK / hasRoleAtLeast
lib/referrals.ts        referral code issuance + reward-granting (called from booking tx)
lib/discountCards.ts    validate/issue a DiscountCard (mirrors lib/promo.ts)
lib/refundPolicy.ts     get/set the RefundPolicy singleton

app/api/booking/route.ts   the whole booking transaction: seat claim, pricing
                            (age + promo/card discount), commission snapshot,
                            referral reward trigger — read this first, it's the
                            center of gravity for the money logic.
app/api/tickets/[id]/cancel/route.ts   the cancel/refund endpoint (self-service
                            for RESERVED, staff-only for paid tickets)

app/admin/**            ADMIN-only (routes constructor, discounts, discount cards,
                         agents/commission+permissions, users/roles, reports, settings)
app/staff/**             AGENT(+granted permission)/ADMIN — tickets search+detail,
                         trip list+manifest. middleware.ts gates by role only;
                         the per-permission check happens inside each page/route
                         via hasStaffPermission (fine-grained, DB-fresh, not baked
                         into the JWT).
app/account/**           self-service: own tickets + history, discount cards,
                         referral link, promo list ("Акції")
```

## Patterns to follow when extending

- **Every Ticket mutation calls `recordTicketHistory`.** There is no
  exception anywhere in the codebase — if you add a new way to change a
  ticket's status or money fields, log it the same way (source, changedBy,
  `requestMeta(req)` for ip/userAgent, and a `changes` diff). This is what
  makes `/staff/tickets/[id]` and `/account/tickets/[id]` show a complete
  history; a silent mutation would create an invisible gap.
- **Two audiences for history**: `/staff/tickets/[id]` shows everything
  (who by email, IP, user-agent, raw field diffs) — staff/admin only.
  `/account/tickets/[id]` shows a customer-safe subset (what happened, when
  — no staff identity, no IP/UA). Keep that separation if you add more
  history-derived views.
- **Staff permission checks happen in the page/route, not middleware.**
  `middleware.ts` only enforces "role ≥ AGENT to reach /staff/**" — it can't
  see the per-agent boolean flags without a DB round-trip per request, so
  each `/staff/**` page/route calls `hasStaffPermission(session, "canX")`
  itself and renders `<AccessDenied>` (or 403) when it's false. ADMIN/SUPER_ADMIN
  always pass. When adding a new staff capability, add a new boolean to
  `User`, a checkbox on `/admin/agents`, and a check at the point of use —
  don't gate it by role alone.
- **Adapter pattern for anything not-yet-real**: `CarrierAdapter`
  (lib/carriers/types.ts) and `PaymentGateway` (lib/payments/gateway.ts) are
  both "the interface is real, the implementation behind it is mocked."
  When a real carrier or payment provider is available, implement the
  interface and swap the registry/`getPaymentGateway()` return value —
  nothing else should need to change. Don't bypass the interface with a
  one-off direct call.
- **Money is snapshotted, never recomputed retroactively.** `commissionAmount`,
  `refundAmount`, `refundWithheld` are written once at the moment they
  happen, using whatever rate/policy was active then. Changing an agent's
  commission or the RefundPolicy percentages must never rewrite past
  tickets — that's why these are columns on `Ticket`, not derived at
  read-time from the current `User.commissionValue` / `RefundPolicy` row.
- **A booking redeems a Promo or a DiscountCard, never both** — enforced by
  a 400 in `app/api/booking/route.ts` before either is validated. If you add
  a third discount mechanism, decide its stacking rule explicitly rather
  than letting it combine implicitly.

## Explicitly not done (by design, not oversight)

- **No real external carrier.** `MockCarrierAdapter` is the only registered
  `CarrierAdapter`; it now searches real DB-backed `Trip` rows (generated
  from `Route` templates) instead of pure fantasy data, but `book()` still
  fabricates a PNR. Wiring a real carrier (FlixBus, ...) means implementing
  `CarrierAdapter` against their API and registering it in
  `lib/carriers/registry.ts` — needs that partner's API details, which
  nobody has supplied yet.
- **No real payment gateway.** `MockPaymentGateway` always "succeeds" for
  the exact requested amount. Booking itself doesn't call any charge API
  either — `/booking`'s footer says "No real payment is processed — this is
  a demo booking flow", and that's still true. Refunds go through
  `PaymentGateway.refund()`, so plugging in Stripe/LiqPay/Fondy/etc. only
  touches `lib/payments/gateway.ts` and (for actually charging at booking
  time, not yet built at all) `app/api/booking/route.ts`.
- **Site content pages are placeholders.** `/oferta`, `/about`, `/contacts`,
  `/partners` have clearly-marked filler copy (`<em>Заповнювальний
  текст…</em>`) — needs real legal/business text from the operator, not
  more engineering.
- **Route constructor is a functional equivalent, not a pixel clone** of any
  specific existing carrier back-office UI (e.g. grandes-tour.com.ua's
  admin) — it covers name/stops/schedule/price/capacity/amenities, nothing
  more elaborate was requested to match exactly.

## Business constants (subject to change — check current values before assuming)

- Age discounts: CHILD_0_4 −30%, CHILD_5_12 −20%, ADULT 0%, SENIOR_60 −10%
  (`lib/pricing.ts`).
- Referral: welcome card for the new signup −5%, reward card for the
  referrer after their friend's first ticket −10%
  (`REFERRAL_WELCOME_PERCENT`/`REFERRAL_REWARD_PERCENT` in `lib/referrals.ts`).
- Refund split: 80% back to the passenger / 20% withheld by default for
  *both* cash and online refunds — admin-editable per channel on
  `/admin/settings` (`RefundPolicy` row, `lib/refundPolicy.ts`).
- Service fee: flat €1.50 per booking (`SERVICE_FEE_EUR`).

## Known correctness caveats worth knowing before you touch nearby code

- Trip times are stored as UTC and treated as if UTC == local departure-city
  time (`lib/routes/generate.ts`'s `combine()`, `app/api/booking/route.ts`'s
  `combineDateTime()`) — there is no per-city timezone handling. Fine for a
  single-country/demo scope; would need real tz-awareness before spanning
  multiple timezones for real.
- `Carrier` identity is just its unique `name` string (no external carrier
  ID) — two differently-named rows for what's really the same operator will
  silently be treated as different carriers. Not an issue until a real
  multi-carrier integration exists.
