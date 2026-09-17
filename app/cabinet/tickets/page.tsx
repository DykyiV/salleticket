import Link from "next/link";
import PageHeader from "@/components/cabinet/PageHeader";
import BoardingHint from "@/components/ticket/BoardingHint";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { findStopForCity } from "@/lib/routes/boarding";

export const dynamic = "force-dynamic";

export default async function CabinetTicketsPage() {
  const user = await getCurrentUser();
  const bookings = user
    ? await prisma.booking.findMany({
        where: { ticket: { userId: user.id } },
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
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    : [];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Квитки"
        subtitle="Ваші бронювання. Посадка і висадка беруться з виїзду."
      />
      {bookings.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-sm text-slate-500 ring-1 ring-slate-200">
          Квитків ще немає.{" "}
          <Link href="/" className="text-brand-700 underline">
            Знайти рейс
          </Link>
        </p>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const trip = booking.ticket.trip;
            const stops = trip?.departure?.stops ?? [];
            const board = findStopForCity(stops, trip?.fromCity);
            const alight = findStopForCity(stops, trip?.toCity);
            return (
              <article
                key={booking.id}
                className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {booking.reference}
                    </p>
                    <p className="text-xs text-slate-500">
                      {trip ? `${trip.fromCity} → ${trip.toCity}` : "Маршрут не привʼязано"}
                    </p>
                  </div>
                  <Link
                    href={`/account/tickets/${booking.reference}/print`}
                    className="rounded border border-slate-300 bg-white px-3 py-1 text-xs"
                  >
                    Друкований квиток
                  </Link>
                </div>
                <div className="mt-3 space-y-1">
                  <BoardingHint label="Посадка" stop={board} />
                  <BoardingHint label="Висадка" stop={alight} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
