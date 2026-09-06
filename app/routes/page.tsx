import Link from "next/link";
import Header from "@/components/Header";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const WEEKDAY_LABELS: Record<number, string> = {
  1: "Пн",
  2: "Вт",
  3: "Ср",
  4: "Чт",
  5: "Пт",
  6: "Сб",
  7: "Нд",
};

function formatDays(csv: string): string {
  const days = csv
    .split(",")
    .map((d) => Number.parseInt(d.trim(), 10))
    .filter((n) => !Number.isNaN(n));
  if (days.length === 7) return "Щодня";
  return days.map((d) => WEEKDAY_LABELS[d] ?? "").join(", ");
}

export default async function RoutesPage() {
  const routes = await prisma.route.findMany({
    where: { isActive: true },
    include: {
      carrier: { select: { name: true, rating: true } },
      stops: { orderBy: { order: "asc" }, select: { city: true } },
    },
    orderBy: { fromCity: "asc" },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Рейси та розклад
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Регулярні напрямки, якими ми курсуємо. Оберіть маршрут, щоб
              одразу перейти до пошуку квитків на потрібну дату.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {routes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              Розклад тимчасово оновлюється — спробуйте пошук на головній
              сторінці.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {routes.map((route) => (
                <div
                  key={route.id}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-base font-semibold text-slate-900">
                    {route.fromCity} → {route.toCity}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {route.carrier.name} · {route.busType}
                  </p>

                  <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                    <span className="font-semibold tabular-nums text-slate-900">
                      {route.departureTime}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span>{formatDays(route.daysOfWeek)}</span>
                  </div>

                  {route.stops.length > 2 ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Зупинки: {route.stops.map((s) => s.city).join(" → ")}
                    </p>
                  ) : null}

                  <div className="mt-4 flex items-center justify-between border-t border-dashed border-slate-200 pt-3">
                    <p className="text-lg font-bold text-slate-900">
                      від €{route.basePrice.toFixed(2)}
                    </p>
                    <Link
                      href={`/results?from=${encodeURIComponent(route.fromCity)}&to=${encodeURIComponent(route.toCity)}`}
                      className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-700"
                    >
                      Знайти квитки
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
