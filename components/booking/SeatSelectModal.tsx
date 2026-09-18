"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SeatMap from "@/components/ticket/SeatMap";
import LegalLinks from "@/components/booking/LegalLinks";
import { btnGhost, btnPrimary, inputClass } from "@/components/admin/Field";
import { formatUkDate } from "@/lib/routes/dates";
import { formatDuration } from "@/lib/mockTrips";
import { emptySeatLayout, type BusLayout } from "@/lib/seats";
import { getBookingSessionId } from "@/lib/seatSession";
import type { Trip } from "@/lib/mockTrips";

const MAX_SEATS = 6;

type TripOption = {
  id: string;
  fromCity: string;
  toCity: string;
  departureTime: string;
  price: number;
  carrier: string;
  hasAssignedSeats: boolean;
};

export default function SeatSelectModal({
  trip,
  date,
  tripKind,
  returnDate,
  onlineDiscountPercent,
  onClose,
}: {
  trip: Trip;
  date?: string;
  tripKind: string;
  returnDate?: string;
  onlineDiscountPercent: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState("server");
  const [virtual, setVirtual] = useState(false);
  const [layout, setLayout] = useState<BusLayout | null>(null);
  const [seats, setSeats] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [retDate, setRetDate] = useState(returnDate ?? "");
  const [returnTrips, setReturnTrips] = useState<TripOption[]>([]);
  const [returnTripId, setReturnTripId] = useState<string | null>(null);
  const [returnLayout, setReturnLayout] = useState<BusLayout | null>(null);
  const [returnSeats, setReturnSeats] = useState<number[]>([]);

  const roundTrip = tripKind === "ROUND_TRIP";
  const assignsSeats = trip.hasAssignedSeats !== false;

  useEffect(() => {
    setSessionId(getBookingSessionId());
  }, []);

  const loadLayout = (sid: string) => {
    const seg =
      trip.fromStopIndex != null && trip.toStopIndex != null
        ? `&fromIndex=${trip.fromStopIndex}&toIndex=${trip.toStopIndex}`
        : "";
    fetch(`/api/trips/${trip.id}/seats?sessionId=${encodeURIComponent(sid)}${seg}`)
      .then((r) => r.json())
      .then((data) => {
        setLayout(data.layout ?? emptySeatLayout());
        setVirtual(Boolean(data.virtual));
      })
      .catch(() => setLayout(emptySeatLayout()));
  };

  useEffect(() => {
    if (sessionId === "server") return;
    loadLayout(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, trip.id]);

  useEffect(() => {
    if (!roundTrip || !retDate) return;
    fetch(
      `/api/trips?from=${encodeURIComponent(trip.to)}&to=${encodeURIComponent(trip.from)}&date=${encodeURIComponent(retDate)}`
    )
      .then((r) => r.json())
      .then((data) => {
        setReturnTrips(data.trips ?? []);
        setReturnTripId(null);
        setReturnLayout(null);
        setReturnSeats([]);
      })
      .catch(() => setReturnTrips([]));
  }, [roundTrip, retDate, trip.from, trip.to]);

  useEffect(() => {
    if (!returnTripId || sessionId === "server") return;
    fetch(
      `/api/trips/${returnTripId}/seats?sessionId=${encodeURIComponent(sessionId)}`
    )
      .then((r) => r.json())
      .then((data) => {
        setReturnLayout(data.layout ?? emptySeatLayout());
        setReturnSeats([]);
      })
      .catch(() => setReturnLayout(emptySeatLayout()));
  }, [returnTripId, sessionId]);

  const hold = async (tripId: string, seatNumber: number) => {
    if (virtual) return true;
    const res = await fetch(`/api/trips/${tripId}/holds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        seatNumber,
        fromStopIndex: trip.fromStopIndex ?? null,
        toStopIndex: trip.toStopIndex ?? null,
      }),
    }).catch(() => null);
    if (!res || !res.ok) {
      const data = res ? await res.json().catch(() => ({})) : {};
      setError(data.error ?? "Місце щойно забронювали");
      return false;
    }
    return true;
  };

  const release = (tripId: string, seatNumber: number) => {
    if (virtual) return;
    void fetch(`/api/trips/${tripId}/holds`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, seatNumber }),
    }).catch(() => {});
  };

  const toggleSeat = async (n: number | null) => {
    if (n == null) return;
    setError(null);
    if (seats.includes(n)) {
      setSeats(seats.filter((s) => s !== n));
      release(trip.id, n);
      return;
    }
    if (seats.length >= MAX_SEATS) {
      setError(`Максимум ${MAX_SEATS} місць за одне бронювання`);
      return;
    }
    if (await hold(trip.id, n)) {
      setSeats([...seats, n]);
    } else {
      loadLayout(sessionId);
    }
  };

  const toggleReturnSeat = async (n: number | null) => {
    if (n == null || !returnTripId) return;
    setError(null);
    if (returnSeats.includes(n)) {
      setReturnSeats(returnSeats.filter((s) => s !== n));
      release(returnTripId, n);
      return;
    }
    if (returnSeats.length >= seats.length) {
      setError("Місць назад не може бути більше, ніж туди");
      return;
    }
    if (await hold(returnTripId, n)) {
      setReturnSeats([...returnSeats, n]);
    }
  };

  const onlinePrice =
    Math.round(trip.price * (1 - onlineDiscountPercent / 100) * 100) / 100;

  const canContinue =
    (!assignsSeats || seats.length > 0) &&
    (!roundTrip ||
      (returnTripId != null &&
        (!returnLayout?.hasAssignedSeats ||
          returnSeats.length === seats.length)));

  const proceed = () => {
    if (!canContinue) {
      setError(
        roundTrip
          ? "Оберіть місця туди й назад для кожного пасажира"
          : "Оберіть хоча б одне місце"
      );
      return;
    }
    const count = Math.max(1, seats.length);
    const params = new URLSearchParams({
      carrier: trip.carrier,
      carrierId: trip.carrierId,
      tripId: trip.id,
      from: trip.from,
      to: trip.to,
      departure: trip.departure,
      arrival: trip.arrival,
      duration: String(trip.durationMinutes),
      price: trip.price.toFixed(2),
      tripKind,
      passengers: String(count),
    });
    if (date) params.set("date", date);
    if (seats.length) params.set("seats", seats.join(","));
    if (roundTrip && returnTripId) {
      params.set("returnTripId", returnTripId);
      if (returnSeats.length) params.set("returnSeats", returnSeats.join(","));
      if (retDate) params.set("returnDate", retDate);
      const selectedReturn = returnTrips.find((t) => t.id === returnTripId);
      if (selectedReturn) {
        params.set("returnPrice", selectedReturn.price.toFixed(2));
      }
    }
    router.push(`/booking?${params.toString()}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {trip.from} → {trip.to}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {trip.carrier} · {trip.departure}–{trip.arrival} ·{" "}
              {formatDuration(trip.durationMinutes)}
              {date ? ` · ${formatUkDate(date)}` : ""}
            </p>
          </div>
          <button type="button" className={btnGhost} onClick={onClose}>
            Закрити
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="tabular-nums text-slate-900">
            €{trip.price.toFixed(2)}
          </span>
          {onlineDiscountPercent > 0 ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              €{onlinePrice.toFixed(2)} онлайн (−{onlineDiscountPercent}%)
            </span>
          ) : null}
          <span className="text-xs text-slate-500">
            {assignsSeats
              ? `Обрано місць: ${seats.length} (макс. ${MAX_SEATS})`
              : "Без призначення місць"}
          </span>
        </div>

        <div className="mt-4">
          {assignsSeats ? (
            layout ? (
              <SeatMap
                layout={layout}
                selectedSeatNumbers={seats}
                onSelect={(n) => void toggleSeat(n)}
              />
            ) : (
              <p className="text-sm text-slate-500">Завантаження схеми місць…</p>
            )
          ) : (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              На цьому рейсі вільна посадка — квиток без номера місця.
            </p>
          )}
        </div>

        {roundTrip ? (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Зворотній рейс ({trip.to} → {trip.from})
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
            <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto">
              {returnTrips.length === 0 ? (
                <li className="text-sm text-slate-500">
                  Немає рейсів на цю дату в зворотному напрямку.
                </li>
              ) : (
                returnTrips.map((option) => (
                  <li key={option.id}>
                    <button
                      type="button"
                      onClick={() => setReturnTripId(option.id)}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                        returnTripId === option.id
                          ? "border-brand-400 bg-brand-50"
                          : "border-slate-200 bg-white hover:border-brand-200"
                      }`}
                    >
                      <span className="font-medium">
                        {formatUkDate(option.departureTime)} ·{" "}
                        {new Date(option.departureTime)
                          .toISOString()
                          .slice(11, 16)}
                      </span>
                      <span className="ml-2 text-slate-500">
                        {option.carrier} · €{option.price.toFixed(2)}
                        {option.hasAssignedSeats ? "" : " · без місць"}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
            {returnTripId && returnLayout ? (
              <div className="mt-3">
                <p className="mb-2 text-xs font-medium text-slate-600">
                  Місця назад ({returnSeats.length} з {Math.max(1, seats.length)})
                </p>
                <SeatMap
                  layout={returnLayout}
                  selectedSeatNumbers={returnSeats}
                  onSelect={(n) => void toggleReturnSeat(n)}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 border-t border-slate-100 pt-3">
          <LegalLinks />
        </div>

        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>
            Скасувати
          </button>
          <button
            type="button"
            className={btnPrimary}
            onClick={proceed}
            disabled={!canContinue}
          >
            Далі · {Math.max(1, seats.length)}{" "}
            {seats.length === 1
              ? "пасажир"
              : seats.length >= 2 && seats.length <= 4
                ? "пасажири"
                : "пасажирів"}
          </button>
        </div>
      </div>
    </div>
  );
}
