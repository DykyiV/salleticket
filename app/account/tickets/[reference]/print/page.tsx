import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { findStopForCity, boardingLabel, mapsUrl } from "@/lib/routes/boarding";
import { weekdayName } from "@/lib/routes/weekdays";

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
    user.role !== "ADMIN" &&
    user.role !== "SUPER_ADMIN" &&
    user.role !== "AGENT"
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
    <main className="mx-auto min-h-screen max-w-xl bg-white p-8 text-slate-900">
      <p className="text-xs uppercase tracking-widest text-slate-500">
        Asol BUS · квиток
      </p>
      <h1 className="mt-1 text-2xl font-bold">{booking.reference}</h1>
      <p className="mt-1 text-sm text-slate-600">
        {booking.firstName} {booking.lastName} · {booking.phone}
      </p>

      <section className="mt-6 border-t border-slate-200 pt-4 text-sm">
        <p className="font-semibold">
          {trip ? `${trip.fromCity} → ${trip.toCity}` : "Маршрут"}
        </p>
        {departure ? (
          <p className="mt-1 text-slate-600">
            {departure.template.name} · {weekdayName(departure.weekday)} · автобус{" "}
            {departure.defaultBus ?? "—"}
          </p>
        ) : null}
        {departure?.busPhone ? (
          <p className="mt-1">Тел. автобуса: {departure.busPhone}</p>
        ) : null}
        {departure?.dispatcherPhone ? (
          <p>Диспетчер: {departure.dispatcherPhone}</p>
        ) : null}
      </section>

      <section className="mt-6 space-y-3 text-sm">
        <div>
          <p className="font-semibold">Посадка</p>
          <p>{board ? boardingLabel(board) : trip?.fromCity ?? "—"}</p>
          {board?.boardingAddress ? <p>{board.boardingAddress}</p> : null}
          {boardUrl ? (
            <p className="break-all text-xs text-slate-500">{boardUrl}</p>
          ) : null}
        </div>
        <div>
          <p className="font-semibold">Висадка</p>
          <p>{alight ? boardingLabel(alight) : trip?.toCity ?? "—"}</p>
          {alight?.boardingAddress ? <p>{alight.boardingAddress}</p> : null}
          {alightUrl ? (
            <p className="break-all text-xs text-slate-500">{alightUrl}</p>
          ) : null}
        </div>
      </section>

      <p className="mt-8 text-xs text-slate-400 print:hidden">
        Натисніть Ctrl+P / Cmd+P, щоб роздрукувати.
      </p>
    </main>
  );
}
