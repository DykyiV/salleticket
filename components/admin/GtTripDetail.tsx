"use client";

import Link from "next/link";
import type { GtPlaceItem } from "@/lib/carriers/grandes-tour/admin";

type Props = {
  tripId: number;
  places: GtPlaceItem[];
  total: number;
  sold: number;
  free: number;
};

const STATUS_STYLES: Record<string, string> = {
  free: "bg-green-100 text-green-800",
  purchased: "bg-red-100 text-red-800",
  reserved: "bg-orange-100 text-orange-800",
  hidden: "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  free: "Вільне",
  purchased: "Продано",
  reserved: "Заброньовано",
  hidden: "Прихованe",
};

export default function GtTripDetail({ tripId, places, total, sold, free }: Props) {
  return (
    <div className="space-y-6">
      <Link href="/cabinet/gt-departures" className="inline-flex items-center text-sm text-blue-600 hover:underline">
        ← Назад до виїздів
      </Link>

      {/* Occupancy summary */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Заповненість</h2>
        <div className="flex gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{sold}</div>
            <div className="text-xs text-gray-500 mt-1">Зайнято</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{free}</div>
            <div className="text-xs text-gray-500 mt-1">Вільно</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-700">{total}</div>
            <div className="text-xs text-gray-500 mt-1">Всього місць</div>
          </div>
        </div>
        {total > 0 && (
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full bg-red-500"
              style={{ width: `${Math.round((sold / total) * 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Places table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            Місця (trip #{tripId})
          </h2>
        </div>
        {places.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Дані про місця відсутні або API не відповів
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Місце", "Тип", "Статус", "Поверх", "Ряд (x)", "Позиція (y)"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {places.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-2 text-gray-600">{p.type}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status] ?? "bg-gray-100 text-gray-700"}`}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{p.floor ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-600">{p.x ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-600">{p.y ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
