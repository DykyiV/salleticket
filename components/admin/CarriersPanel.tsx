"use client";

import type { CarrierGroup, BusEntry } from "@/lib/carriers/grandes-tour/admin";

type Props = {
  carriers: CarrierGroup[];
  asOf: string;
};

function BusTable({ buses }: { buses: BusEntry[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-100 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {["Номер автобуса", "Рейсів", "Перший виїзд", "Останній виїзд"].map((h) => (
              <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {buses.map((b) => (
            <tr key={b.busNumber} className="hover:bg-gray-50">
              <td className="px-4 py-2 font-mono font-medium text-gray-900">{b.busNumber}</td>
              <td className="px-4 py-2 text-gray-700">{b.tripCount}</td>
              <td className="px-4 py-2 text-gray-600">{b.firstSeen || "—"}</td>
              <td className="px-4 py-2 text-gray-600">{b.lastSeen || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CarriersPanel({ carriers, asOf }: Props) {
  if (carriers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
        <p className="text-sm font-medium text-gray-600">Дані про перевізників відсутні</p>
        <p className="mt-1 text-xs text-gray-400">
          Інформація про автобуси збирається з рейсів — рейси перевізника видно в розділі «Виїзди»
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {carriers.map((carrier) => (
        <div key={carrier.name} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gray-50 px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">{carrier.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {carrier.buses.length} {carrier.buses.length === 1 ? "автобус" : "автобусів"}
            </p>
          </div>
          <BusTable buses={carrier.buses} />
        </div>
      ))}

      <p className="text-xs text-gray-400">
        Дані зібрані з рейсів GT за останні 30 і наступні 30 днів. Оновлено: {asOf}
      </p>
    </div>
  );
}
