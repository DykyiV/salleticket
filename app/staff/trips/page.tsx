import Link from "next/link";
import Header from "@/components/Header";
import AccessDenied from "@/components/staff/AccessDenied";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { hasStaffPermission } from "@/lib/auth/staffPermissions";

export const dynamic = "force-dynamic";

function formatDateTime(d: Date): string {
  return d.toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function StaffTripsPage() {
  const session = await getSession();
  if (!session || !(await hasStaffPermission(session, "canAccessStaffTrips"))) {
    return <AccessDenied what="перегляд списку рейсів" />;
  }

  const trips = await prisma.trip.findMany({
    where: { departureTime: { gte: new Date() } },
    include: {
      carrier: true,
      route: { select: { name: true } },
      seats: { select: { status: true } },
      _count: { select: { tickets: true } },
    },
    orderBy: { departureTime: "asc" },
    take: 100,
  });

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
                Найближчі рейси
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Оберіть рейс, щоб побачити маршрут із зупинками та список
                заброньованих пасажирів.
              </p>
            </div>
            <Link
              href="/agent"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              Назад
            </Link>
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3">Відправлення</th>
                  <th className="border-b border-slate-200 px-4 py-3">Маршрут</th>
                  <th className="border-b border-slate-200 px-4 py-3">Перевізник</th>
                  <th className="border-b border-slate-200 px-4 py-3">Заброньовано</th>
                  <th className="border-b border-slate-200 px-4 py-3">Вільно місць</th>
                </tr>
              </thead>
              <tbody>
                {trips.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                      Немає майбутніх рейсів. Створіть активний маршрут в{" "}
                      <Link href="/admin/routes" className="underline">
                        конструкторі маршрутів
                      </Link>
                      .
                    </td>
                  </tr>
                ) : (
                  trips.map((trip) => {
                    const seatsLeft = trip.seats.filter(
                      (s) => s.status === "AVAILABLE"
                    ).length;
                    return (
                      <tr key={trip.id} className="odd:bg-white even:bg-slate-50">
                        <td className="border-t border-slate-100 px-4 py-3 tabular-nums">
                          {formatDateTime(trip.departureTime)}
                        </td>
                        <td className="border-t border-slate-100 px-4 py-3">
                          <Link
                            href={`/staff/trips/${trip.id}`}
                            className="font-medium text-brand-700 hover:underline"
                          >
                            {trip.fromCity} → {trip.toCity}
                          </Link>
                          {trip.route?.name ? (
                            <p className="text-xs text-slate-500">{trip.route.name}</p>
                          ) : null}
                        </td>
                        <td className="border-t border-slate-100 px-4 py-3">
                          {trip.carrier.name}
                        </td>
                        <td className="border-t border-slate-100 px-4 py-3 tabular-nums">
                          {trip._count.tickets}
                        </td>
                        <td className="border-t border-slate-100 px-4 py-3 tabular-nums">
                          {trip.seats.length > 0 ? seatsLeft : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
