import Link from "next/link";
import PageHeader from "@/components/cabinet/PageHeader";
import BoardingHint from "@/components/ticket/BoardingHint";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { findStopForCity } from "@/lib/routes/boarding";
import { formatUkDate } from "@/lib/routes/dates";
import { weekdayShort } from "@/lib/routes/weekdays";
import {
  AGE_LABEL,
  eur,
  TICKET_STATUS_CLASS,
  TICKET_STATUS_LABEL,
} from "@/lib/tickets/labels";

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
        subtitle="Ваші бронювання. Відкрийте квиток, щоб змінити дані пасажира, або друковану версію."
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
            const departure = trip?.departure;
            const stops = departure?.stops ?? [];
            const board = findStopForCity(stops, trip?.fromCity);
            const alight = findStopForCity(stops, trip?.toCity);
            const status = booking.ticket.status;
            return (
              <article
                key={booking.id}
                className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {booking.reference}
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        {trip ? `${trip.fromCity} → ${trip.toCity}` : "Маршрут не привʼязано"}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {booking.firstName} {booking.lastName} · {booking.phone}
                      {booking.ageCategory
                        ? ` · ${AGE_LABEL[booking.ageCategory] ?? booking.ageCategory}`
                        : ""}
                    </p>
                    {trip ? (
                      <p className="mt-1 text-xs text-slate-500">
                        {formatUkDate(trip.departureTime)} ·{" "}
                        {weekdayShort(
                          departure?.weekday ??
                            ((trip.departureTime.getUTCDay() || 7) as number)
                        )}
                        {trip.carrier?.name ? ` · ${trip.carrier.name}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold tabular-nums">
                      {eur(booking.finalPrice)}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${TICKET_STATUS_CLASS[status]}`}
                    >
                      {TICKET_STATUS_LABEL[status]}
                    </span>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  <BoardingHint label="Посадка" stop={board} />
                  <BoardingHint label="Висадка" stop={alight} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/cabinet/tickets/${booking.reference}`}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Відкрити / редагувати
                  </Link>
                  <Link
                    href={`/account/tickets/${booking.reference}/print`}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                  >
                    Друкований квиток
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
