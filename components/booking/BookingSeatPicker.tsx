"use client";

import { useEffect, useState } from "react";
import SeatMap from "@/components/ticket/SeatMap";
import { formatUkDate } from "@/lib/routes/dates";
import { emptySeatLayout, type BusLayout } from "@/lib/seats";
import type { TripKindId } from "@/lib/tickets/kinds";
import { inputClass } from "@/components/admin/Field";

type TripOption = {
  id: string;
  fromCity: string;
  toCity: string;
  departureTime: string;
  price: number;
  carrier: string;
  hasAssignedSeats: boolean;
};

export type BookingSeatValue = {
  seatNumber: number | null;
  returnTripId: string | null;
  returnSeatNumber: number | null;
  returnPrice: number;
  outboundAssignsSeats: boolean;
  returnAssignsSeats: boolean;
};

export default function BookingSeatPicker({
  tripId,
  from,
  to,
  tripKind,
  returnDate,
  sessionId,
  onChange,
}: {
  tripId?: string;
  from: string;
  to: string;
  tripKind: TripKindId;
  returnDate?: string;
  sessionId: string;
  onChange: (value: BookingSeatValue) => void;
}) {
  const [outboundLayout, setOutboundLayout] = useState<BusLayout | null>(null);
  const [seat, setSeat] = useState<number | null>(null);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [retDate, setRetDate] = useState(returnDate ?? "");
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [returnTripId, setReturnTripId] = useState<string | null>(null);
  const [returnLayout, setReturnLayout] = useState<BusLayout | null>(null);
  const [returnSeat, setReturnSeat] = useState<number | null>(null);
  const [returnPrice, setReturnPrice] = useState(0);

  const loadOutboundLayout = () => {
    if (!tripId) {
      setOutboundLayout(emptySeatLayout());
      return;
    }
    fetch(`/api/trips/${tripId}/seats?sessionId=${encodeURIComponent(sessionId)}`)
      .then((r) => r.json())
      .then((data) => setOutboundLayout(data.layout ?? emptySeatLayout()))
      .catch(() => setOutboundLayout(emptySeatLayout()));
  };

  useEffect(() => {
    loadOutboundLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, sessionId]);

  const holdSeat = async (next: number | null, prev: number | null) => {
    setHoldError(null);
    if (!tripId) return;
    if (prev != null && prev !== next) {
      await fetch(`/api/trips/${tripId}/holds`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, seatNumber: prev }),
      }).catch(() => {});
    }
    if (next == null) return;
    const res = await fetch(`/api/trips/${tripId}/holds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, seatNumber: next }),
    }).catch(() => null);
    if (!res || !res.ok) {
      const data = res ? await res.json().catch(() => ({})) : {};
      setHoldError(data.error ?? "Місце щойно забронювали");
      setSeat(null);
      loadOutboundLayout();
    }
  };

  const selectOutbound = (next: number | null) => {
    const prev = seat;
    setSeat(next);
    void holdSeat(next, prev);
  };

  useEffect(() => {
    if (tripKind !== "ROUND_TRIP" || !retDate) return;
    fetch(
      `/api/trips?from=${encodeURIComponent(to)}&to=${encodeURIComponent(from)}&date=${encodeURIComponent(retDate)}`
    )
      .then((r) => r.json())
      .then((data) => {
        setTrips(data.trips ?? []);
        setReturnTripId(null);
        setReturnLayout(null);
        setReturnSeat(null);
        setReturnPrice(0);
      })
      .catch(() => setTrips([]));
  }, [tripKind, retDate, from, to]);

  useEffect(() => {
    if (!returnTripId) return;
    fetch(
      `/api/trips/${returnTripId}/seats?sessionId=${encodeURIComponent(sessionId)}`
    )
      .then((r) => r.json())
      .then((data) => {
        setReturnLayout(data.layout ?? emptySeatLayout());
        setReturnSeat(null);
      })
      .catch(() => setReturnLayout(emptySeatLayout()));
  }, [returnTripId, sessionId]);

  const selectReturn = (next: number | null) => {
    const prev = returnSeat;
    setReturnSeat(next);
    if (!returnTripId) return;
    setHoldError(null);
    if (prev != null && prev !== next) {
      void fetch(`/api/trips/${returnTripId}/holds`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, seatNumber: prev }),
      }).catch(() => {});
    }
    if (next == null) return;
    void (async () => {
      const res = await fetch(`/api/trips/${returnTripId}/holds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, seatNumber: next }),
      }).catch(() => null);
      if (!res || !res.ok) {
        const data = res ? await res.json().catch(() => ({})) : {};
        setHoldError(data.error ?? "Місце щойно забронювали");
        setReturnSeat(null);
      }
    })();
  };

  useEffect(() => {
    onChange({
      seatNumber: seat,
      returnTripId,
      returnSeatNumber: returnSeat,
      returnPrice,
      outboundAssignsSeats: outboundLayout?.hasAssignedSeats !== false,
      returnAssignsSeats: returnLayout?.hasAssignedSeats !== false,
    });
  }, [
    seat,
    returnTripId,
    returnSeat,
    returnPrice,
    outboundLayout,
    returnLayout,
    onChange,
  ]);

  return (
    <div className="mt-6 space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Місце в салоні</h3>
        <p className="mt-1 text-xs text-slate-500">
          За замовчуванням місце обирається при бронюванні і фіксується в квитку.
        </p>
        <div className="mt-3">
          {outboundLayout ? (
            <SeatMap
              layout={outboundLayout}
              selectedSeatNumber={seat}
              onSelect={selectOutbound}
            />
          ) : (
            <p className="text-sm text-slate-500">Завантаження схеми місць…</p>
          )}
          {holdError ? (
            <p className="mt-2 text-sm text-rose-700">{holdError}</p>
          ) : null}
          {seat != null && !holdError ? (
            <p className="mt-2 text-xs text-emerald-700">
              Місце {seat} тимчасово закріплене за вами на час бронювання.
            </p>
          ) : null}
        </div>
      </div>

      {tripKind === "OPEN_RETURN" ? (
        <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          Зворотня поїздка з відкритою датою. Дату рейсу і місце назад оберете
          пізніше в квитку.
        </div>
      ) : null}

      {tripKind === "ROUND_TRIP" ? (
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Зворотній рейс
          </h3>
          <label className="mt-2 block text-xs">
            <span className="mb-1 block font-medium text-slate-600">
              Дата повернення
            </span>
            <input
              type="date"
              className={`${inputClass} w-48`}
              value={retDate}
              onChange={(e) => setRetDate(e.target.value)}
            />
          </label>
          <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
            {trips.length === 0 ? (
              <li className="text-sm text-slate-500">
                Немає рейсів на цю дату в зворотному напрямку.
              </li>
            ) : (
              trips.map((trip) => (
                <li key={trip.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setReturnTripId(trip.id);
                      setReturnPrice(trip.price);
                    }}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                      returnTripId === trip.id
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
          {returnTripId && returnLayout ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-medium text-slate-600">
                Місце назад
              </p>
              <SeatMap
                layout={returnLayout}
                selectedSeatNumber={returnSeat}
                onSelect={selectReturn}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
