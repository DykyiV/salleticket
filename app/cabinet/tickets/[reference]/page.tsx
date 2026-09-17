import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/cabinet/PageHeader";
import BoardingHint from "@/components/ticket/BoardingHint";
import PassengerEditor from "@/components/ticket/PassengerEditor";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";
import { findStopForCity } from "@/lib/routes/boarding";
import { formatUkDate } from "@/lib/routes/dates";
import { weekdayName } from "@/lib/routes/weekdays";
import {
  AGE_LABEL,
  eur,
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
          trip: {
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

  const trip = booking.ticket.trip;
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
      </section>

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
      </section>

      {booking.ticket.history.length > 0 ? (
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Історія змін</h2>
          <ul className="mt-3 divide-y divide-slate-100 text-xs">
            {booking.ticket.history.map((row) => (
              <li key={row.id} className="py-2 text-slate-600">
                <span className="tabular-nums text-slate-400">
                  {row.timestamp.toISOString().slice(0, 16).replace("T", " ")}
                </span>
                <span className="ml-2 font-medium text-slate-800">{row.action}</span>
                {row.source ? (
                  <span className="ml-2 text-slate-400">{row.source}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
