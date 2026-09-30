"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import SeatMap from "@/components/ticket/SeatMap";
import { btnGhost, btnPrimary, inputClass } from "@/components/admin/Field";
import { formatTripMoment } from "@/lib/tickets/boardingPass";
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
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10);
}

export default function ChangeSeatModal({
  ticketId,
  leg,
  tripId,
  fromCity,
  toCity,
  initialDate,
  initialSeat,
  title = "Оберіть місце",
  onClose,
}: {
  ticketId: string;
  leg: "outbound" | "return";
  tripId: string;
  fromCity: string;
  toCity: string;
  initialDate: string;
  initialSeat: number | null;
  title?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState(isoDate(initialDate));
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [nearby, setNearby] = useState(false);
  const [activeTripId, setActiveTripId] = useState<string | null>(tripId);
  const [layout, setLayout] = useState<BusLayout | null>(null);
  const [seat, setSeat] = useState<number | null>(initialSeat);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingTrips, setLoadingTrips] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoadingTrips(true);
    setError(null);
    const day = isoDate(date);
    fetch(
      `/api/trips?from=${encodeURIComponent(fromCity)}&to=${encodeURIComponent(toCity)}&date=${encodeURIComponent(day)}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancel) return;
        const list = (data.trips ?? []) as TripOption[];
        setTrips(list);
        setNearby(Boolean(data.nearby));
        const current = list.find((trip) => trip.id === tripId);
        setActiveTripId(current?.id ?? (list.length === 1 ? list[0].id : null));
      })
      .catch(() => {
        if (!cancel) setError("Не вдалося завантажити рейси");
      })
      .finally(() => {
        if (!cancel) setLoadingTrips(false);
      });
    return () => {
      cancel = true;
    };
  }, [date, fromCity, toCity, tripId]);

  useEffect(() => {
    if (!activeTripId) {
      setLayout(null);
      return;
    }
    let cancel = false;
    setLayout(null);
    fetch(`/api/trips/${activeTripId}/seats?exceptTicketId=${encodeURIComponent(ticketId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancel) return;
        setLayout(data.layout ?? null);
        setSeat(activeTripId === tripId ? initialSeat : null);
      })
      .catch(() => {
        if (!cancel) setError("Не вдалося завантажити місця");
      });
    return () => {
      cancel = true;
    };
  }, [activeTripId, ticketId, tripId, initialSeat]);

  const save = async () => {
    if (!activeTripId) {
      setError("Оберіть рейс");
      return;
    }
    if (layout?.hasAssignedSeats && seat == null) {
      setError("Оберіть вільне місце");
      return;
    }
    setBusy(true);
    setError(null);
    const sameTrip = activeTripId === tripId;
    const url = sameTrip
      ? `/api/account/tickets/${ticketId}/seat`
      : `/api/account/tickets/${ticketId}/${leg === "return" ? "return" : "trip"}`;
    const body = sameTrip
      ? { seatNumber: seat, leg }
      : { tripId: activeTripId, seatNumber: seat };
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Не вдалося зберегти");
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
      setBusy(false);
    }
  };

  const showTripList = trips.length > 1 || (trips.length > 0 && !trips.some((trip) => trip.id === tripId));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4">
      <div className="my-4 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {fromCity} → {toCity}. Зайняті місця вибрати не можна.
            </p>
          </div>
          <button type="button" className={btnGhost} onClick={onClose}>
            Закрити
          </button>
        </div>

        <label className="mt-4 block text-xs">
          <span className="mb-1 block font-medium text-slate-600">Інша дата рейсу</span>
          <input
            type="date"
            className={`${inputClass} w-48`}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        {nearby && trips.length > 0 ? (
          <p className="mt-2 text-xs text-slate-500">На обрану дату рейсів немає — показано найближчі.</p>
        ) : null}
        {loadingTrips ? <p className="mt-3 text-sm text-slate-500">Шукаємо рейси…</p> : null}
        {!loadingTrips && trips.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Немає рейсів на цю дату.</p>
        ) : null}
        {showTripList ? (
          <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto">
            {trips.map((trip) => (
              <li key={trip.id}>
                <button
                  type="button"
                  onClick={() => setActiveTripId(trip.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                    activeTripId === trip.id
                      ? "border-brand-400 bg-brand-50"
                      : "border-slate-200 bg-white hover:border-brand-200"
                  }`}
                >
                  <span className="font-medium">{formatTripMoment(new Date(trip.departureTime))}</span>
                  <span className="ml-2 text-slate-500">
                    {trip.carrier}
                    {trip.id === tripId ? " · поточний" : ""}
                    {trip.hasAssignedSeats ? "" : " · без місць"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 border-t border-slate-100 pt-4">
          {layout ? (
            <SeatMap layout={layout} selectedSeatNumber={seat} onSelect={setSeat} />
          ) : (
            <p className="text-sm text-slate-500">
              {activeTripId ? "Завантаження схеми місць…" : "Оберіть рейс, щоб побачити вільні місця."}
            </p>
          )}
        </div>
        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose} disabled={busy}>
            Скасувати
          </button>
          <button type="button" className={btnPrimary} onClick={save} disabled={busy || !activeTripId}>
            {busy ? "Збереження…" : "Зберегти місце"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChangeSeatButton({
  label,
  className,
  ...modal
}: {
  label: string;
  className?: string;
} & Omit<ComponentProps<typeof ChangeSeatModal>, "onClose">) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "font-semibold text-brand-800 underline decoration-brand-300 underline-offset-2 hover:text-brand-900"
        }
      >
        {label}
      </button>
      {open ? <ChangeSeatModal {...modal} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
