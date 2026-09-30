import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import BoardingPassCard from "@/components/ticket/BoardingPassCard";
import { ChangeSeatButton } from "@/components/ticket/ChangeSeatModal";
import { toBoardingPass } from "@/lib/tickets/boardingPass";
import PassengerEditor from "@/components/ticket/PassengerEditor";
import TicketItineraryEditor from "@/components/ticket/TicketItineraryEditor";
import TicketPaymentActions from "@/components/ticket/TicketPaymentActions";
import RecalcPriceButton from "@/components/ticket/RecalcPriceButton";
import TicketComments from "@/components/ticket/TicketComments";
import SendSmsButton from "@/components/ticket/SendSmsButton";
import DialogButton from "@/components/ui/DialogButton";
import { ticketAccess } from "@/lib/tickets/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { reconcileTicketPayment } from "@/lib/payments";
import { getSiteSettings } from "@/lib/settings";
import { qrCodeDataUrl } from "@/lib/tickets/qrcode";
import { buildTimeline } from "@/lib/tickets/timeline";
import { formatUkDate } from "@/lib/routes/dates";
import { weekdayName } from "@/lib/routes/weekdays";
import {
  AGE_LABEL,
  eur,
  HISTORY_ACTION_LABEL,
  TICKET_STATUS_CLASS,
  TICKET_STATUS_LABEL,
} from "@/lib/tickets/labels";
import { MONEY_TONE_CLASS, moneyState, priceBreakdown } from "@/lib/tickets/ticketMoney";

export const dynamic = "force-dynamic";

/**
 * Ticket card, one screen: left — passenger and trip (bus, seat, boarding);
 * right — status, number, QR, downloads and the price block. The status is
 * not edited by hand: it follows from how the ticket was booked and paid
 * (see TicketPaymentActions). History and comments open in dialogs.
 */
export default async function CabinetTicketEditPage(props: {
  params: Promise<{ reference: string }>;
}) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) return null;

  const booking = await prisma.booking.findUnique({
    where: { reference: params.reference },
    select: { id: true, ticketId: true },
  });
  if (!booking) notFound();

  // Settle / expire a pending online payment before showing the ticket.
  await reconcileTicketPayment(booking.ticketId);

  const full = await prisma.booking.findUnique({
    where: { id: booking.id },
    include: {
      ticket: {
        include: {
          history: { orderBy: { timestamp: "desc" } },
          comments: { orderBy: { createdAt: "asc" } },
          cashCollectedBy: { select: { email: true, displayName: true } },
          payments: { orderBy: { createdAt: "desc" }, take: 1 },
          legs: {
            orderBy: { order: "asc" },
            include: {
              trip: { select: { fromCity: true, toCity: true } },
              assignment: { include: { bus: true } },
            },
          },
          trip: {
            include: {
              carrier: true,
              departure: { include: { stops: true, template: true, bus: true } },
            },
          },
          returnTrip: {
            include: {
              carrier: true,
              departure: { include: { stops: true, template: true, bus: true } },
            },
          },
        },
      },
    },
  });
  if (!full) notFound();
  const ticket = full.ticket;

  const staff = hasRoleAtLeast(user.role, "AGENT");
  const isOwner = ticket.userId === user.id;
  if (!isOwner && !staff) notFound();
  const access = await ticketAccess({ sub: user.id, role: user.role }, ticket.userId);
  const [canEditBooking, canCancel, canRefund, settings] = await Promise.all([
    staff ? can(user, "booking.edit") : Promise.resolve(false),
    staff ? can(user, "booking.cancel") : Promise.resolve(false),
    staff ? can(user, "payment.refund") : Promise.resolve(false),
    getSiteSettings(),
  ]);

  const actorIds = [...new Set(ticket.history.map((row) => row.changedBy).filter((id): id is string => Boolean(id)))];
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, displayName: true, email: true },
      })
    : [];
  const actorNames = new Map(actors.map((a) => [a.id, `${a.displayName?.trim() || a.email.split("@")[0]}`]));
  const timeline = buildTimeline(ticket.history, actorNames, (action) => HISTORY_ACTION_LABEL[action] ?? action);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const qrCode = await qrCodeDataUrl(`${proto}://${host}/check/${full.reference}`);

  const trip = ticket.trip;
  const returnTrip = ticket.returnTrip;
  const departure = trip?.departure;
  const status = ticket.status;
  const pass = toBoardingPass(full);

  const payment = ticket.payments[0] ?? null;
  const livePayment = payment && ["PENDING", "SENT", "SETTLED"].includes(payment.status) ? payment : null;
  const statusSince = ticket.history.find((row) => row.newStatus === status)?.timestamp ?? null;
  const price = priceBreakdown({
    basePrice: ticket.basePrice,
    finalPrice: ticket.finalPrice,
    ageCategory: full.ageCategory,
    promoCode: full.promoCode,
    onlinePayment: livePayment,
  });
  const money = moneyState({
    status,
    finalPrice: ticket.finalPrice,
    payment: livePayment,
    cashCollector: ticket.cashCollectedBy
      ? ticket.cashCollectedBy.displayName
        ? `${ticket.cashCollectedBy.displayName} (${ticket.cashCollectedBy.email})`
        : ticket.cashCollectedBy.email
      : null,
    cashCollectedAt: ticket.cashCollectedAt,
    statusSince,
  });

  const buses = [
    ...new Set(
      ticket.legs
        .map((leg) => (leg.assignment ? `${leg.assignment.bus.model ?? "Автобус"} ${leg.assignment.bus.plate}` : null))
        .filter((b): b is string => Boolean(b))
    ),
  ];
  const busLabel = buses.length ? buses.join(", ") : departure?.defaultBus ?? null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-sm">
        <Link href="/cabinet/tickets" className="text-slate-500 hover:text-brand-700">
          ← Квитки
        </Link>
        <span className="text-slate-300">/</span>
        <span className="font-mono font-semibold text-slate-900">{full.reference}</span>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        {/* ---------------- Left: passenger + trip ---------------- */}
        <div className="space-y-3">
          <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Пасажир</h2>
            <PassengerEditor
              key={`${full.firstName}-${full.lastName}-${full.phone}-${full.email}`}
              ticketId={ticket.id}
              category={AGE_LABEL[full.ageCategory] ?? full.ageCategory}
              canEdit={access.canEdit}
              passenger={{
                firstName: full.firstName,
                lastName: full.lastName,
                phone: full.phone,
                phone2: full.phone2,
                phone3: full.phone3,
                email: full.email,
              }}
            />
          </section>

          <BoardingPassCard
            pass={pass}
            seatAction={
              access.canEdit && trip ? (
                <ChangeSeatButton
                  label={pass.seatLabel}
                  ticketId={ticket.id}
                  leg="outbound"
                  tripId={trip.id}
                  fromCity={trip.fromCity}
                  toCity={trip.toCity}
                  initialDate={trip.departureTime.toISOString().slice(0, 10)}
                  initialSeat={ticket.seatNumber}
                />
              ) : undefined
            }
            returnSeatAction={
              access.canEdit && returnTrip ? (
                <ChangeSeatButton
                  label={ticket.returnSeatNumber != null ? String(ticket.returnSeatNumber) : "обрати"}
                  ticketId={ticket.id}
                  leg="return"
                  tripId={returnTrip.id}
                  fromCity={returnTrip.fromCity}
                  toCity={returnTrip.toCity}
                  initialDate={returnTrip.departureTime.toISOString().slice(0, 10)}
                  initialSeat={ticket.returnSeatNumber}
                  title="Оберіть місце назад"
                />
              ) : undefined
            }
          />

          <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Коментар</h2>
            <TicketComments
              ticketId={ticket.id}
              comments={ticket.comments.map((c) => ({
                id: c.id,
                text: c.text,
                authorEmail: c.authorEmail,
                createdAt: c.createdAt.toISOString(),
              }))}
              canComment={access.canEdit}
            />
          </section>

          {staff ? <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Рейс</h2>
            <p className="mt-1 text-base font-semibold text-slate-900">
              {trip ? `${trip.fromCity} → ${trip.toCity}` : "Маршрут не привʼязано"}
            </p>
            {trip ? (
              <p className="text-sm text-slate-600">
                {formatUkDate(trip.departureTime)}
                {departure ? ` · ${weekdayName(departure.weekday)}` : ""}
                {trip.carrier?.name ? ` · ${trip.carrier.name}` : ""}
                {departure?.template?.name ? (
                  <span className="text-slate-400"> · {departure.template.name}</span>
                ) : null}
              </p>
            ) : null}

            <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
              <div className="flex gap-2">
                <dt className="text-slate-500">Автобус:</dt>
                <dd className="text-slate-900">{busLabel ?? "не призначено"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-slate-500">Місце:</dt>
                <dd className="font-semibold text-slate-900">
                  {access.canEdit && trip ? (
                    <ChangeSeatButton
                      label={
                        departure?.hasAssignedSeats === false
                          ? "без місць"
                          : ticket.seatNumber != null
                            ? String(ticket.seatNumber)
                            : "не обрано"
                      }
                      ticketId={ticket.id}
                      leg="outbound"
                      tripId={trip.id}
                      fromCity={trip.fromCity}
                      toCity={trip.toCity}
                      initialDate={trip.departureTime.toISOString().slice(0, 10)}
                      initialSeat={ticket.seatNumber}
                    />
                  ) : departure?.hasAssignedSeats === false ? (
                    "без місць"
                  ) : ticket.seatNumber != null ? (
                    ticket.seatNumber
                  ) : (
                    "не обрано"
                  )}
                  {ticket.returnSeatNumber != null ? (
                    <span className="font-normal text-slate-500"> · назад {ticket.returnSeatNumber}</span>
                  ) : null}
                </dd>
              </div>
            </dl>

            {ticket.legs.length > 1 ? (
              <ul className="mt-3 space-y-1 text-sm">
                {ticket.legs.map((leg) => (
                  <li key={leg.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-1">
                    <span className="text-xs font-semibold text-slate-500">Плече {leg.order}</span>
                    <span className="text-slate-900">
                      {leg.fromCity ?? leg.trip.fromCity} → {leg.toCity ?? leg.trip.toCity}
                    </span>
                    <span className="font-mono text-xs text-slate-600">
                      {leg.assignment ? `${leg.assignment.bus.model ?? "Автобус"} ${leg.assignment.bus.plate}` : "автобус не призначено"}
                    </span>
                    {leg.seatNumber != null ? (
                      <span className="rounded bg-white px-1.5 py-0.5 text-xs font-semibold text-brand-800 ring-1 ring-brand-200">
                        місце {leg.seatNumber}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-3 border-t border-slate-100 pt-3">
              <TicketItineraryEditor
                ticketId={ticket.id}
                tripKind={ticket.tripKind}
                outbound={{
                  tripId: trip?.id ?? null,
                  fromCity: trip?.fromCity ?? "",
                  toCity: trip?.toCity ?? "",
                  date: trip ? trip.departureTime.toISOString().slice(0, 10) : null,
                  seatNumber: ticket.seatNumber,
                  hasAssignedSeats: departure?.hasAssignedSeats !== false,
                }}
                returnLeg={
                  ticket.tripKind === "ONE_WAY"
                    ? null
                    : {
                        tripId: returnTrip?.id ?? null,
                        fromCity: returnTrip?.fromCity ?? trip?.toCity ?? "",
                        toCity: returnTrip?.toCity ?? trip?.fromCity ?? "",
                        date: returnTrip ? returnTrip.departureTime.toISOString().slice(0, 10) : null,
                        seatNumber: ticket.returnSeatNumber,
                        hasAssignedSeats: returnTrip?.departure?.hasAssignedSeats !== false,
                      }
                }
              />
            </div>
          </section> : null}

          <div className="flex flex-wrap gap-2">
            <DialogButton label={`Історія квитка (${timeline.length})`} title={`Історія квитка ${full.reference}`}>
              {timeline.length === 0 ? (
                <p className="text-sm text-slate-500">Подій ще немає.</p>
              ) : (
                <ol>
                  {timeline.map((entry) => (
                    <li key={entry.id} className="relative flex gap-3 pb-4">
                      <span className="relative flex flex-col items-center">
                        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-brand-500 ring-2 ring-brand-100" />
                        <span className="w-px flex-1 bg-slate-200" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs tabular-nums text-slate-400">{entry.time}</p>
                        <p className="text-sm font-medium text-slate-900">{entry.action}</p>
                        <p className="text-xs text-slate-500">{entry.actor}</p>
                        {entry.lines.length > 0 ? (
                          <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                            {entry.lines.map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </DialogButton>
          </div>
        </div>

        {/* ---------------- Right: status, QR, downloads, price ---------------- */}
        <div className="space-y-3 lg:sticky lg:top-4">
          <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <span
                  data-testid="ticket-status"
                  className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${TICKET_STATUS_CLASS[status]}`}
                >
                  {TICKET_STATUS_LABEL[status]}
                </span>
                <p className="mt-2 text-xs text-slate-500">Посадковий талон</p>
                <p className="font-mono text-xl font-bold tracking-widest text-slate-900">{full.reference}</p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCode}
                alt={`QR-код квитка ${full.reference}`}
                className="h-24 w-24 shrink-0 rounded-lg ring-1 ring-slate-200"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <a
                href={`/api/tickets/${full.reference}/pdf`}
                className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
              >
                PDF
              </a>
              <Link
                href={`/account/tickets/${full.reference}/print`}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-300"
              >
                Друк
              </Link>
              <a
                href={`/api/tickets/${full.reference}/wallet`}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-300"
              >
                Google Wallet
              </a>
              {hasRoleAtLeast(user.role, "ADMIN") ? (
                <SendSmsButton ticketId={ticket.id} passengerName={`${full.firstName} ${full.lastName}`.trim()} />
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Вартість</h2>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Тариф</dt>
                <dd className="tabular-nums text-slate-900">{eur(price.base)}</dd>
              </div>
              {price.discounts.map((d) => (
                <div key={d.label} className="flex justify-between">
                  <dt className="text-slate-500">{d.label}</dt>
                  <dd className="tabular-nums text-emerald-700">−{eur(d.amount)}</dd>
                </div>
              ))}
            </dl>
            <div data-testid="ticket-money" className={`mt-3 rounded-xl px-3 py-2.5 ring-1 ring-inset ${MONEY_TONE_CLASS[money.tone]}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold">{money.label}</span>
                <span className="text-xl font-bold tabular-nums">{eur(money.amount)}</span>
              </div>
              {money.note ? <p className="mt-0.5 text-xs opacity-75">{money.note}</p> : null}
              {status === "AWAITING_PAYMENT" && livePayment?.status === "PENDING" && (isOwner || staff) ? (
                <Link
                  href={`/pay/${full.reference}`}
                  className="mt-2 inline-flex h-8 items-center rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  Сплатити зараз
                </Link>
              ) : null}
            </div>
            <div className="mt-3">
              <TicketPaymentActions
                ticketId={ticket.id}
                reference={full.reference}
                status={status}
                canCash={staff && canEditBooking}
                canCancel={isOwner || canCancel}
                canRefund={canRefund}
                canPayOnline={isOwner || staff}
                deadlineHours={settings.paymentDeadlineHours}
              />
            </div>
            {user.role === "SUPER_ADMIN" ? (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <RecalcPriceButton ticketId={ticket.id} />
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
