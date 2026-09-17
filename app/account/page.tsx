import Link from "next/link";
import Header from "@/components/Header";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { findStopForCity } from "@/lib/routes/boarding";
import BoardingHint from "@/components/ticket/BoardingHint";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
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
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Кабінет пасажира
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Квитки, посадка і висадка за адресою або координатами з шаблону маршруту.
          </p>

          {user ? (
            <div className="mt-8 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
              <div className="p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Signed in as
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {user.email}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Role:{" "}
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
                    {user.role}
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50 p-4">
                <Link
                  href="/"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
                >
                  Book a trip
                </Link>
                {(user.role === "ADMIN" || user.role === "SUPER_ADMIN") && (
                  <Link
                    href="/admin"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
                  >
                    Admin console
                  </Link>
                )}
                {(user.role === "AGENT" ||
                  user.role === "ADMIN" ||
                  user.role === "SUPER_ADMIN") && (
                  <Link
                    href="/agent"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
                  >
                    Agent console
                  </Link>
                )}
              </div>
            </div>
          ) : null}

          <section className="mt-8 space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Мої квитки</h2>
            {bookings.length === 0 ? (
              <p className="text-sm text-slate-500">Квитків ще немає.</p>
            ) : (
              bookings.map((booking) => {
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
                          {trip
                            ? `${trip.fromCity} → ${trip.toCity}`
                            : "Маршрут не привʼязано"}
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
              })
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
