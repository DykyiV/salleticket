"use client";

import type { GtRoute, GtStop } from "@/lib/carriers/grandes-tour/admin";

type Props = { routes: GtRoute[] };

const DAY_MAP: Record<string, string> = {
  "1": "Пн", Mon: "Пн", Monday: "Пн",
  "2": "Вт", Tue: "Вт", Tuesday: "Вт",
  "3": "Ср", Wed: "Ср", Wednesday: "Ср",
  "4": "Чт", Thu: "Чт", Thursday: "Чт",
  "5": "Пт", Fri: "Пт", Friday: "Пт",
  "6": "Сб", Sat: "Сб", Saturday: "Сб",
  "7": "Нд", Sun: "Нд", Sunday: "Нд",
  "0": "Нд",
};

function formatDays(days: string[] | undefined): string {
  if (!days || days.length === 0) return "—";
  return days.map((d) => DAY_MAP[d] ?? d).join(", ");
}

function StopsSection({ stops }: { stops: GtStop[] }) {
  if (stops.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Зупинки</h4>
      {/* Visual route line */}
      <div className="mb-3 flex flex-wrap items-center gap-1 text-xs text-gray-600">
        {stops.map((s, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-gray-300">→</span>}
            <span>{s.cityName}</span>
          </span>
        ))}
      </div>
      {/* Detailed table */}
      <div className="overflow-x-auto rounded border border-gray-100">
        <table className="min-w-full divide-y divide-gray-100 text-xs">
          <thead className="bg-gray-50">
            <tr>
              {["#", "Місто", "Зупинка", "Туди", "Назад"].map((h, i) => (
                <th key={i} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stops.map((s, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                <td className="px-3 py-1.5 font-medium text-gray-800">{s.cityName}</td>
                <td className="px-3 py-1.5 text-gray-600">{s.place ?? "—"}</td>
                <td className="px-3 py-1.5 font-mono text-gray-600">{s.outTime ?? "—"}</td>
                <td className="px-3 py-1.5 font-mono text-gray-600">{s.backTime ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RouteCard({ route }: { route: GtRoute }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{route.name}</h3>
          {route.countryIso && (
            <span className="mt-0.5 text-xs text-gray-500 uppercase">{route.countryIso}</span>
          )}
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-500">Дні виїзду:</span>
          <div className="text-sm font-medium text-gray-800">{formatDays(route.scheduleDays)}</div>
        </div>
      </div>
      {route.description && (
        <p className="mt-2 text-sm text-gray-600">{route.description}</p>
      )}
      {route.stops && route.stops.length > 0 && <StopsSection stops={route.stops} />}
    </div>
  );
}

export default function GtRoutesList({ routes }: Props) {
  if (routes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-gray-600">Маршрути від перевізника відсутні або API не відповів</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {routes.map((r) => (
        <RouteCard key={r.id} route={r} />
      ))}
      <p className="text-xs text-gray-400">Джерело: Grandes Tour API · {routes.length} маршрутів</p>
    </div>
  );
}
