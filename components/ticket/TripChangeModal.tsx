"use client";

import { useEffect, useState } from "react";
import SeatMap from "@/components/ticket/SeatMap";
import { PriceCalendar } from "@/components/home/DatePicker";
import { btnGhost, btnPrimary } from "@/components/admin/Field";
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

function isoDate(value: string | undefined): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : new Date().toISOString().slice(0, 10);
}

/**
 * Another date and seat for a ticket: the route's price calendar on top, the
 * departures of the chosen day, then the seat map of the chosen departure.
 * Opens on the ticket's current departure (preselected when found).
 */
export default function TripChangeModal({
  fromCity,
  toCity,
  initialDate,
  exceptTicketId,
  title,
  confirmLabel,
  onClose,
  onSave,
  carrier = null,
  currentTripId = null,
  currentDeparture = null,
  initialSeat = null,
}: {
  fromCity: string;
  toCity: string;
  initialDate: string;
  exceptTicketId?: string;
  title: string;
  confirmLabel: string;
  onClose: () => void;
  onSave: (tripId: string, seatNumber: number | null, date: string) => Promise<void>;
  /** "grandes-tour": departures and seats come from the carrier. */
  carrier?: "grandes-tour" | null;
  /** The ticket's current departure (own trip id / departure time). */
  currentTripId?: string | null;
  currentDeparture?: string | null;
  initialSeat?: number | null;
}) {
  const [date, setDate] = useState(isoDate(initialDate));
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [nearby, setNearby] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);
  const [layout, setLayout] = useState<BusLayout | null>(null);
  const [seat, setSeat] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const day = isoDate(date);
    fetch(
      `/api/trips?from=${encodeURIComponent(fromCity)}&to=${encodeURIComponent(toCity)}&date=${encodeURIComponent(day)}${
        carrier ? `&carrier=${carrier}` : ""
      }`
    )
      .then((r) => r.json())
      .then((data) => {
        const list = (data.trips ?? []) as TripOption[];
        setTrips(list);
        setNearby(Boolean(data.nearby));
        const current =
          list.find((t) => t.id === currentTripId) ??
          (currentDeparture ? list.find((t) => t.departureTime === currentDeparture) : undefined);
        setTripId(current?.id ?? (list.length === 1 ? list[0].id : null));
        setLayout(null);
        setSeat(null);
        if (data.nearby && list[0]?.departureTime) {
          const next = String(list[0].departureTime).slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(next) && next !== day) {
            setDate(next);
          }
        }
      })
      .catch(() => setError("Не вдалося завантажити рейси"));
  }, [date, fromCity, toCity, carrier, currentTripId, currentDeparture]);

  useEffect(() => {
    if (!tripId) return;
    const qs = exceptTicketId
      ? `?exceptTicketId=${encodeURIComponent(exceptTicketId)}`
      : "";
    fetch(`/api/trips/${tripId}/seats${qs}`)
      .then((r) => r.json())
      .then((data) => {
        setLayout(data.layout ?? null);
        // Own trips show the ticket's seat as free: keep it picked.
        setSeat(tripId === currentTripId ? initialSeat : null);
      })
      .catch(() => setError("Не вдалося завантажити місця"));
  }, [tripId, exceptTicketId, currentTripId, initialSeat]);

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
      await onSave(tripId, seat, date);
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
          {currentDeparture ? (
            <>
              {" "}
              · зараз: {formatUkDate(currentDeparture)} {currentDeparture.slice(11, 16)}
              {initialSeat != null ? `, місце ${initialSeat}` : ""}
            </>
          ) : null}
        </p>
        {carrier === "grandes-tour" ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
            Квиток буде переброньовано в Grandes Tour: нове місце бронюється, старе звільняється. Ціна —
            за тарифом нового рейсу.
          </p>
        ) : null}
        <div className="mt-4 max-w-sm">
          <PriceCalendar value={date} min={new Date().toISOString().slice(0, 10)} from={fromCity} to={toCity} onPick={setDate} />
        </div>
        {nearby && trips.length > 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            На обрану дату рейсів немає — показано найближчі.
          </p>
        ) : null}
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
