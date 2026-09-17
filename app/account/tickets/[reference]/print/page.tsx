import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";
import { findStopForCity, boardingLabel, mapsUrl } from "@/lib/routes/boarding";
import { formatUkDate } from "@/lib/routes/dates";
import { weekdayName } from "@/lib/routes/weekdays";
import {
  AGE_LABEL,
  eur,
  TICKET_STATUS_LABEL,
} from "@/lib/tickets/labels";

export const dynamic = "force-dynamic";

export default async function PrintTicketPage({
  params,
}: {
  params: { reference: string };
}) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const booking = await prisma.booking.findUnique({
    where: { reference: params.reference },
    include: {
      ticket: {
        include: {
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
  if (
    booking.ticket.userId !== user.id &&
    !hasRoleAtLeast(user.role, "AGENT")
  ) {
    notFound();
  }

  const trip = booking.ticket.trip;
  const departure = trip?.departure;
  const board = findStopForCity(departure?.stops ?? [], trip?.fromCity);
  const alight = findStopForCity(departure?.stops ?? [], trip?.toCity);
  const boardUrl = board ? mapsUrl(board) : null;
  const alightUrl = alight ? mapsUrl(alight) : null;

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-white p-8 text-slate-900 print:p-0">
      <div className="rounded-2xl border border-slate-300 p-6 print:border-black">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">
              Asol BUS · квиток
            </p>
            <h1 className="mt-1 text-2xl font-bold">{booking.reference}</h1>
          </div>
          <p className="text-right text-xs font-semibold uppercase">
            {TICKET_STATUS_LABEL[booking.ticket.status]}
          </p>
        </div>

        <section className="mt-6 border-t border-slate-200 pt-4">
          <p className="text-lg font-semibold">
            {trip ? `${trip.fromCity} → ${trip.toCity}` : "Маршрут"}
          </p>
          {trip ? (
            <p className="mt-1 text-sm text-slate-600">
              {formatUkDate(trip.departureTime)}
              {departure ? ` · ${weekdayName(departure.weekday)}` : ""}
            </p>
          ) : null}
          {departure?.template?.name ? (
            <p className="mt-1 text-sm text-slate-600">{departure.template.name}</p>
          ) : null}
          {trip?.carrier?.name ? (
            <p className="text-sm text-slate-600">Перевізник: {trip.carrier.name}</p>
          ) : null}
          {departure?.defaultBus ? (
            <p className="text-sm text-slate-600">Автобус: {departure.defaultBus}</p>
          ) : null}
        </section>

        <section className="mt-6 border-t border-slate-200 pt-4 text-sm">
          <p className="font-semibold">
            {booking.firstName} {booking.lastName}
          </p>
          <p className="text-slate-600">
            {AGE_LABEL[booking.ageCategory] ?? booking.ageCategory} · {booking.phone}
          </p>
          {booking.email ? <p className="text-slate-600">{booking.email}</p> : null}
          <p className="mt-2 text-base font-bold">{eur(booking.finalPrice)}</p>
        </section>

        <section className="mt-6 grid gap-4 border-t border-slate-200 pt-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Посадка
            </p>
            <p className="mt-1 font-medium">
              {board ? boardingLabel(board) : trip?.fromCity ?? "—"}
            </p>
            {board?.boardingAddress ? <p>{board.boardingAddress}</p> : null}
            {board?.outboundTime ? <p>Час: {board.outboundTime}</p> : null}
            {boardUrl ? (
              <p className="mt-1 break-all text-xs text-slate-500">{boardUrl}</p>
            ) : null}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Висадка
            </p>
            <p className="mt-1 font-medium">
              {alight ? boardingLabel(alight) : trip?.toCity ?? "—"}
            </p>
            {alight?.boardingAddress ? <p>{alight.boardingAddress}</p> : null}
            {alight?.outboundTime ? <p>Час: {alight.outboundTime}</p> : null}
            {alightUrl ? (
              <p className="mt-1 break-all text-xs text-slate-500">{alightUrl}</p>
            ) : null}
          </div>
        </section>

        {departure?.busPhone || departure?.dispatcherPhone ? (
          <section className="mt-6 border-t border-slate-200 pt-4 text-sm text-slate-600">
            {departure.busPhone ? <p>Тел. автобуса: {departure.busPhone}</p> : null}
            {departure.dispatcherPhone ? (
              <p>Диспетчер: {departure.dispatcherPhone}</p>
            ) : null}
          </section>
        ) : null}
      </div>

      <p className="mt-6 text-center text-xs text-slate-400 print:hidden">
        Натисніть Ctrl+P / Cmd+P, щоб роздрукувати.
      </p>
    </main>
  );
}
