"use client";

import { useState } from "react";
import Link from "next/link";
import type { GtDepartureItem } from "@/lib/carriers/grandes-tour/admin";

type Props = {
  initialTrips: GtDepartureItem[];
  initialFrom: string;
  initialTo: string;
};

function statusBadge(status: string | undefined) {
  if (!status) return null;
  const color =
    status === "active" ? "bg-green-100 text-green-800" :
    status === "cancelled" ? "bg-red-100 text-red-800" :
    "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {status}
    </span>
  );
}

export default function GtDeparturesBoard({ initialTrips, initialFrom, initialTo }: Props) {
  const [trips, setTrips] = useState<GtDepartureItem[]>(initialTrips);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/gt-departures?from=${from}&to=${to}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { trips: GtDepartureItem[] };
      setTrips(data.trips ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка завантаження");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Від</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">До</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Завантаження…" : "Оновити"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {trips.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Виїздів не знайдено за вказаний період
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Дата виїзду", "Звідки", "Куди", "Відправлення", "Прибуття", "Автобус", "Перевізник", "Напрямок", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {trips.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{t.departureDate}</td>
                    <td className="px-4 py-3 text-gray-700">{t.from}</td>
                    <td className="px-4 py-3 text-gray-700">{t.to}</td>
                    <td className="px-4 py-3 text-gray-700">{t.departureTime}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {t.arrivalDate !== t.departureDate ? `${t.arrivalDate} ` : ""}
                      {t.arrivalTime}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">{t.busNumber}</td>
                    <td className="px-4 py-3 text-gray-700">{t.carrierName}</td>
                    <td className="px-4 py-3">{statusBadge(t.status)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/cabinet/gt-departures/${t.id}?from=${t.cityFromId ?? ""}&to=${t.cityToId ?? ""}&title=${encodeURIComponent(`${t.from} → ${t.to}, ${t.departureDate} ${t.departureTime}, ${t.busNumber}`)}`}
                        className="text-blue-600 hover:underline text-xs font-medium"
                      >
                        Деталі →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Всього: {trips.length} виїздів · Джерело: Grandes Tour API
      </p>
    </div>
  );
}
