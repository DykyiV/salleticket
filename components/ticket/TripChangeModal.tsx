"use client";

import { useEffect, useState } from "react";
import SeatMap from "@/components/ticket/SeatMap";
import { btnGhost, btnPrimary, inputClass } from "@/components/admin/Field";
import { formatUkDate } from "@/lib/routes/dates";
import type { BusLayout } from "@/lib/seats";

type TripOption = {
  id: string;
  fromCity: string;
  toCity: string;
  departureTime: string;
  price: number;
  carrier: string;
  hasAssignedSeats: boolean;
};

export default function TripChangeModal({
  fromCity,
  toCity,
  initialDate,
  exceptTicketId,
  title,
  confirmLabel,
  onClose,
  onSave,
}: {
  fromCity: string;
  toCity: string;
  initialDate: string;
  exceptTicketId?: string;
  title: string;
  confirmLabel: string;
  onClose: () => void;
  onSave: (tripId: string, seatNumber: number | null) => Promise<void>;
}) {
  const [date, setDate] = useState(initialDate);
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [tripId, setTripId] = useState<string | null>(null);
  const [layout, setLayout] = useState<BusLayout | null>(null);
  const [seat, setSeat] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!date) return;
    fetch(
      `/api/trips?from=${encodeURIComponent(fromCity)}&to=${encodeURIComponent(toCity)}&date=${encodeURIComponent(date)}`
    )
      .then((r) => r.json())
      .then((data) => {
        setTrips(data.trips ?? []);
        setTripId(null);
        setLayout(null);
        setSeat(null);
      })
      .catch(() => setError("Не вдалося завантажити рейси"));
  }, [date, fromCity, toCity]);

  useEffect(() => {
    if (!tripId) return;
    const qs = exceptTicketId
      ? `?exceptTicketId=${encodeURIComponent(exceptTicketId)}`
      : "";
    fetch(`/api/trips/${tripId}/seats${qs}`)
      .then((r) => r.json())
      .then((data) => {
        setLayout(data.layout ?? null);
        setSeat(null);
      })
      .catch(() => setError("Не вдалося завантажити місця"));
  }, [tripId, exceptTicketId]);

  const save = async () => {
    if (!tripId) {
      setError("Оберіть рейс");
      return;
    }
    if (layout?.hasAssignedSeats && seat == null) {
      setError("Оберіть місце");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(tripId, seat);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" className={btnGhost} onClick={onClose}>
            Закрити
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {fromCity} → {toCity}
        </p>
        <label className="mt-4 block text-xs">
          <span className="mb-1 block font-medium text-slate-600">Дата</span>
          <input
            type="date"
            className={`${inputClass} w-48`}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
          {trips.length === 0 ? (
            <li className="text-sm text-slate-500">Немає рейсів на цю дату.</li>
          ) : (
            trips.map((trip) => (
              <li key={trip.id}>
                <button
                  type="button"
                  onClick={() => setTripId(trip.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                    tripId === trip.id
                      ? "border-brand-400 bg-brand-50"
                      : "border-slate-200 bg-white hover:border-brand-200"
                  }`}
                >
                  <span className="font-medium">
                    {formatUkDate(trip.departureTime)} ·{" "}
                    {new Date(trip.departureTime).toISOString().slice(11, 16)}
                  </span>
                  <span className="ml-2 text-slate-500">
                    {trip.carrier} · €{trip.price.toFixed(2)}
                    {trip.hasAssignedSeats ? "" : " · без місць"}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
        {tripId && layout ? (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <SeatMap layout={layout} selectedSeatNumber={seat} onSelect={setSeat} />
          </div>
        ) : null}
        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose} disabled={busy}>
            Скасувати
          </button>
          <button type="button" className={btnPrimary} onClick={save} disabled={busy}>
            {busy ? "Збереження…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
