import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import AccessDenied from "@/components/staff/AccessDenied";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { hasStaffPermission } from "@/lib/auth/staffPermissions";

export const dynamic = "force-dynamic";

function formatTime(minutesFromMidnight: number): string {
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("uk-UA", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const STATUS_STYLES: Record<string, string> = {
  RESERVED: "bg-amber-50 text-amber-700 ring-amber-200",
  PAID_ONLINE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PAID_CASH: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-500 ring-slate-200",
  REFUNDED: "bg-rose-50 text-rose-700 ring-rose-200",
};

export default async function StaffTripDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session || !(await hasStaffPermission(session, "canAccessStaffTrips"))) {
    return <AccessDenied what="перегляд рейсу та списку пасажирів" />;
  }

  const trip = await prisma.trip.findUnique({
    where: { id: params.id },
    include: {
      carrier: true,
      route: { include: { stops: { orderBy: { order: "asc" } } } },
      seats: { select: { status: true } },
      tickets: {
        include: {
          booking: true,
          user: { select: { email: true } },
          seat: { select: { number: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!trip) notFound();

  const seatsLeft = trip.seats.filter((s) => s.status === "AVAILABLE").length;
  const departureMinutes = trip.route
    ? Number.parseInt(trip.route.departureTime.split(":")[0], 10) * 60 +
      Number.parseInt(trip.route.departureTime.split(":")[1], 10)
    : null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-100">
                STAFF
              </span>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                {trip.fromCity} → {trip.toCity}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {formatDate(trip.departureTime)} · {trip.carrier.name}
                {trip.route?.name ? ` · ${trip.route.name}` : ""}
              </p>
            </div>
            <Link
              href="/staff/trips"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              Усі рейси
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-slate-900">
                  Зупинки маршруту
                </h2>
                {trip.route && trip.route.stops.length > 0 ? (
                  <ol className="mt-4 space-y-3">
                    {trip.route.stops.map((stop, index) => (
                      <li key={stop.id} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-100">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">
                            {stop.city}
                            {departureMinutes != null ? (
                              <span className="ml-2 font-normal text-slate-500 tabular-nums">
                                {formatTime(departureMinutes + stop.offsetMinutes)}
                              </span>
                            ) : null}
                          </p>
                          {stop.address ? (
                            <p className="text-xs text-slate-500">{stop.address}</p>
                          ) : null}
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {stop.isPickup && stop.isDropoff
                              ? "Посадка та висадка"
                              : stop.isPickup
                                ? "Тільки посадка"
                                : "Тільки висадка"}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Для цього рейсу не задано детального маршруту.
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-slate-900">
                  Заброньовані пасажири ({trip.tickets.length})
                </h2>
                {trip.tickets.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">
                    На цей рейс поки немає бронювань.
                  </p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="border-b border-slate-200 py-2 pr-3">Квиток</th>
                          <th className="border-b border-slate-200 py-2 pr-3">Пасажир</th>
                          <th className="border-b border-slate-200 py-2 pr-3">Телефон</th>
                          <th className="border-b border-slate-200 py-2 pr-3">Місце</th>
                          <th className="border-b border-slate-200 py-2 pr-3">Статус</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trip.tickets.map((t) => (
                          <tr key={t.id}>
                            <td className="border-t border-slate-100 py-2 pr-3 font-mono">
                              {t.booking?.reference ?? "—"}
                            </td>
                            <td className="border-t border-slate-100 py-2 pr-3">
                              <p className="font-medium text-slate-900">
                                {t.booking
                                  ? `${t.booking.firstName} ${t.booking.lastName}`
                                  : t.user.email}
                              </p>
                            </td>
                            <td className="border-t border-slate-100 py-2 pr-3 tabular-nums">
                              {t.booking?.phone ?? "—"}
                            </td>
                            <td className="border-t border-slate-100 py-2 pr-3 tabular-nums">
                              {t.seat?.number ?? "—"}
                            </td>
                            <td className="border-t border-slate-100 py-2 pr-3">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                                  STATUS_STYLES[t.status] ??
                                  "bg-slate-100 text-slate-600 ring-slate-200"
                                }`}
                              >
                                {t.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            <aside className="lg:sticky lg:top-20 lg:self-start">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Місткість
                </p>
                {trip.seats.length > 0 ? (
                  <>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                      {seatsLeft} / {trip.seats.length}
                    </p>
                    <p className="text-xs text-slate-500">вільних місць</p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">
                    Інвентар місць не відстежується для цього рейсу.
                  </p>
                )}
                <div className="mt-4 border-t border-dashed border-slate-200 pt-3 text-sm">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Ціна</span>
                    <span className="tabular-nums">€{trip.price.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
