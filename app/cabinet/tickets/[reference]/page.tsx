import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import PageHeader from "@/components/cabinet/PageHeader";
import BoardingHint from "@/components/ticket/BoardingHint";
import CancelTicketButton from "@/components/ticket/CancelTicketButton";
import PassengerEditor from "@/components/ticket/PassengerEditor";
import TicketItineraryEditor from "@/components/ticket/TicketItineraryEditor";
import TicketStatusControl from "@/components/ticket/TicketStatusControl";
import RecalcPriceButton from "@/components/ticket/RecalcPriceButton";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";
import { reconcileTicketPayment } from "@/lib/payments";
import { qrCodeDataUrl } from "@/lib/tickets/qrcode";
import { buildTimeline } from "@/lib/tickets/timeline";
import { findStopForCity } from "@/lib/routes/boarding";
import { formatUkDate } from "@/lib/routes/dates";
import { weekdayName } from "@/lib/routes/weekdays";
import {
  AGE_LABEL,
  eur,
  HISTORY_ACTION_LABEL,
  TICKET_STATUS_CLASS,
  TICKET_STATUS_LABEL,
} from "@/lib/tickets/labels";

export const dynamic = "force-dynamic";

export default async function CabinetTicketEditPage({
  params,
}: {
  params: { reference: string };
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const booking = await prisma.booking.findUnique({
    where: { reference: params.reference },
    include: {
      ticket: {
        include: {
          history: { orderBy: { timestamp: "desc" } },
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
              departure: { include: { stops: true, template: true } },
            },
          },
          returnTrip: {
            include: {
              carrier: true,
              departure: { include: { stops: true, template: true } },
            },
          },
        },
      },
    },
  });
  if (!booking) notFound();

  const staff = hasRoleAtLeast(user.role, "AGENT");
  if (booking.ticket.userId !== user.id && !staff) notFound();

  await reconcileTicketPayment(booking.ticket.id);
  const freshTicket = await prisma.ticket.findUnique({
    where: { id: booking.ticket.id },
    include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const payment = freshTicket?.payments[0] ?? null;
  if (freshTicket) {
    booking.ticket.status = freshTicket.status;
    booking.ticket.finalPrice = freshTicket.finalPrice;
  }

  const actorIds = [
    ...new Set(
      booking.ticket.history
        .map((row) => row.changedBy)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, displayName: true, email: true, role: true },
      })
    : [];
  const actorNames = new Map(
    actors.map((a) => [
      a.id,
      `${a.displayName?.trim() || a.email.split("@")[0]}`,
    ])
  );
  const timeline = buildTimeline(
    booking.ticket.history,
    actorNames,
    (action) => HISTORY_ACTION_LABEL[action] ?? action
  );

  const host = headers().get("x-forwarded-host") ?? headers().get("host");
  const proto = headers().get("x-forwarded-proto") ?? "http";
  const qrPayload = `${proto}://${host}/check/${booking.reference}`;
  const qrCode = await qrCodeDataUrl(qrPayload);

  const trip = booking.ticket.trip;
  const returnTrip = booking.ticket.returnTrip;
  const departure = trip?.departure;
  const stops = departure?.stops ?? [];
  const board = findStopForCity(stops, trip?.fromCity);
  const alight = findStopForCity(stops, trip?.toCity);
  const status = booking.ticket.status;
  const discount =
    booking.ticket.basePrice > booking.ticket.finalPrice
      ? booking.ticket.basePrice - booking.ticket.finalPrice
      : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title={booking.reference}
        subtitle="Редагування квитка: дані пасажира, маршрут і посадка з виїзду."
      />

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${TICKET_STATUS_CLASS[status]}`}
        >
          {TICKET_STATUS_LABEL[status]}
        </span>
        <span className="text-sm font-bold tabular-nums">{eur(booking.finalPrice)}</span>
        {user.role === "SUPER_ADMIN" ? (
          <RecalcPriceButton ticketId={booking.ticket.id} />
        ) : null}
        <Link
          href={`/account/tickets/${booking.reference}/print`}
          className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
        >
          Друкований квиток
        </Link>
        <Link
          href="/cabinet/tickets"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
        >
          До списку
        </Link>
      </div>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">Квиток — 3 варіанти</h2>
        <div className="mt-3 flex flex-wrap items-center gap-5">
          <div className="min-w-40">
            <p className="text-xs text-slate-500">Номер бронювання</p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-slate-900">
              {booking.reference}
            </p>
            <a
              href={`/api/tickets/${booking.reference}/pdf`}
              className="mt-3 inline-block rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
            >
              Завантажити PDF
            </a>
            <a
              href={`/api/tickets/${booking.reference}/wallet`}
              className="mt-3 ml-2 inline-block rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              Google Wallet
            </a>
          </div>
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrCode}
              alt={`QR-код квитка ${booking.reference}`}
              className="h-28 w-28 rounded-lg ring-1 ring-slate-200"
            />
            <p className="mt-1 text-[11px] text-slate-500">QR для посадки</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">Пасажир</h2>
        <p className="mt-1 text-xs text-slate-500">
          {AGE_LABEL[booking.ageCategory] ?? booking.ageCategory}
        </p>
        <div className="mt-4">
          <PassengerEditor
            key={`${booking.firstName}-${booking.lastName}-${booking.phone}-${booking.email}`}
            ticketId={booking.ticket.id}
            passenger={{
              firstName: booking.firstName,
              lastName: booking.lastName,
              phone: booking.phone,
              email: booking.email,
            }}
          />
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">Рейс</h2>
        <p className="mt-2 text-base font-semibold text-slate-900">
          {trip ? `${trip.fromCity} → ${trip.toCity}` : "Маршрут не привʼязано"}
        </p>
        {trip ? (
          <p className="mt-1 text-sm text-slate-600">
            {formatUkDate(trip.departureTime)}
            {departure ? ` · ${weekdayName(departure.weekday)}` : ""}
            {trip.carrier?.name ? ` · ${trip.carrier.name}` : ""}
          </p>
        ) : null}
        {departure?.template?.name ? (
          <p className="mt-1 text-xs text-slate-500">{departure.template.name}</p>
        ) : null}
        {departure?.defaultBus ? (
          <p className="mt-1 text-xs text-slate-500">Автобус: {departure.defaultBus}</p>
        ) : null}
        <div className="mt-4 space-y-1">
          <BoardingHint label="Посадка" stop={board} />
          <BoardingHint label="Висадка" stop={alight} />
        </div>
        {booking.ticket.legs.length > 0 ? (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Плечі поїздки (реальні автобуси)
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {booking.ticket.legs.map((leg) => (
                <li
                  key={leg.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5"
                >
                  <span className="text-xs font-semibold text-slate-500">
                    Плече {leg.order}
                  </span>
                  <span className="text-slate-900">
                    {leg.fromCity ?? leg.trip.fromCity} → {leg.toCity ?? leg.trip.toCity}
                  </span>
                  <span className="font-mono text-xs text-slate-600">
                    {leg.assignment
                      ? `${leg.assignment.bus.model ?? "Автобус"} ${leg.assignment.bus.plate}`
                      : "автобус не призначено"}
                  </span>
                  {leg.seatNumber != null ? (
                    <span className="rounded bg-white px-1.5 py-0.5 text-xs font-semibold text-brand-800 ring-1 ring-brand-200">
                      місце {leg.seatNumber}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-4 border-t border-slate-100 pt-4">
          <TicketItineraryEditor
            ticketId={booking.ticket.id}
            tripKind={booking.ticket.tripKind}
            outbound={{
              tripId: trip?.id ?? null,
              fromCity: trip?.fromCity ?? "",
              toCity: trip?.toCity ?? "",
              date: trip ? trip.departureTime.toISOString().slice(0, 10) : null,
              seatNumber: booking.ticket.seatNumber,
              hasAssignedSeats: departure?.hasAssignedSeats !== false,
            }}
            returnLeg={
              booking.ticket.tripKind === "ONE_WAY"
                ? null
                : {
                    tripId: returnTrip?.id ?? null,
                    fromCity: returnTrip?.fromCity ?? trip?.toCity ?? "",
                    toCity: returnTrip?.toCity ?? trip?.fromCity ?? "",
                    date: returnTrip
                      ? returnTrip.departureTime.toISOString().slice(0, 10)
                      : null,
                    seatNumber: booking.ticket.returnSeatNumber,
                    hasAssignedSeats:
                      returnTrip?.departure?.hasAssignedSeats !== false,
                  }
            }
          />
        </div>
      </section>

      {staff ? (
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Статус</h2>
          <p className="mt-1 text-xs text-slate-500">
            Зміна записується в історію квитка.
          </p>
          <div className="mt-4">
            <TicketStatusControl
              ticketId={booking.ticket.id}
              currentStatus={status}
            />
          </div>
        </section>
      ) : status === "RESERVED" ? (
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Скасування</h2>
          <p className="mt-1 text-xs text-slate-500">
            Незаплачений квиток можна скасувати самостійно.
          </p>
          <div className="mt-4">
            <CancelTicketButton ticketId={booking.ticket.id} />
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">Оплата</h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-slate-500">Базова ціна</dt>
          <dd className="text-right tabular-nums">{eur(booking.ticket.basePrice)}</dd>
          <dt className="text-slate-500">Знижка</dt>
          <dd className="text-right tabular-nums">
            {discount > 0 ? `−${eur(discount)}` : "—"}
          </dd>
          <dt className="font-medium text-slate-900">До сплати</dt>
          <dd className="text-right font-semibold tabular-nums">
            {eur(booking.finalPrice)}
          </dd>
        </dl>
        {payment ? (
          <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm">
            <p className="font-medium text-violet-900">
              Онлайн-оплата: {eur(payment.amount)}
              {payment.fullAmount > payment.amount
                ? ` замість ${eur(payment.fullAmount)}`
                : ""}
            </p>
            <p className="mt-0.5 text-xs text-violet-700">
              {payment.status === "SETTLED"
                ? "Кошти зараховано."
                : payment.status === "SENT"
                  ? "Оплату надіслано — очікуємо зарахування коштів (20–30 хв)."
                  : payment.status === "EXPIRED"
                    ? "Дедлайн минув — знижка згоріла, квиток за повною ціною."
                    : `Оплатіть до ${payment.deadlineAt.toLocaleString("uk-UA")} — інакше знижка згорить.`}
            </p>
            {booking.ticket.status === "AWAITING_PAYMENT" &&
            payment.status !== "EXPIRED" ? (
              <Link
                href={`/pay/${booking.reference}`}
                className="mt-2 inline-block rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                {payment.status === "SENT" ? "Статус оплати" : "Сплатити зараз"}
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>

      {timeline.length > 0 ? (
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">
            Таймлайн бронювання
          </h2>
          <ol className="mt-4 space-y-0">
            {timeline.map((entry) => (
              <li key={entry.id} className="relative flex gap-3 pb-4">
                <span className="relative flex flex-col items-center">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-brand-500 ring-2 ring-brand-100" />
                  <span className="w-px flex-1 bg-slate-200" />
                </span>
                <div className="min-w-0 flex-1 pb-1">
                  <p className="text-xs tabular-nums text-slate-400">
                    {entry.time}
                  </p>
                  <p className="text-sm font-medium text-slate-900">
                    {entry.action}
                  </p>
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
        </section>
      ) : null}
    </div>
  );
}
