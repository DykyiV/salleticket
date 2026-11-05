"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import SeatPickerModal from "@/components/ticket/SeatPickerModal";
import TripChangeModal from "@/components/ticket/TripChangeModal";
import { addUtcDays, formatUkDate, toIsoDate, utcDateOnly } from "@/lib/routes/dates";
import { TRIP_KIND_LABEL } from "@/lib/tickets/labels";

type Leg = {
  tripId: string | null;
  fromCity: string;
  toCity: string;
  date: string | null;
  seatNumber: number | null;
  hasAssignedSeats: boolean;
};

export default function TicketItineraryEditor({
  ticketId,
  tripKind,
  outbound,
  returnLeg,
  carrier = null,
  departureTime = null,
  changeBlocked = null,
  returnChangeBlocked = null,
}: {
  ticketId: string;
  tripKind: string;
  outbound: Leg;
  returnLeg: Leg | null;
  /** "grandes-tour": the date / seat is changed by re-reserving at the carrier. */
  carrier?: "grandes-tour" | null;
  /** Outbound departure, ISO (preselected in the change window). */
  departureTime?: string | null;
  /** Why the outbound date / seat can't be changed here (null = it can). */
  changeBlocked?: string | null;
  /** The same for the return trip. */
  returnChangeBlocked?: string | null;
}) {
  const router = useRouter();
  const [seatModal, setSeatModal] = useState<"return" | null>(null);
  const [dateModal, setDateModal] = useState<"outbound" | "return" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Seat or date of the outbound trip: one window with the calendar and the seat map. */
  const openOutbound = () => {
    setNotice(null);
    if (changeBlocked) setError(changeBlocked);
    else setDateModal("outbound");
  };

  const openReturnLeg = (open: () => void) => {
    setNotice(null);
    if (returnChangeBlocked) setError(returnChangeBlocked);
    else open();
  };

  const patch = async (url: string, body: unknown) => {
    setError(null);
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data.error ?? "Не вдалося зберегти";
      setError(message);
      throw new Error(message);
    }
    router.refresh();
    return data as { price?: number; oldPrice?: number };
  };

  const openReturn = tripKind === "OPEN_RETURN" && !returnLeg?.tripId;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">{TRIP_KIND_LABEL[tripKind] ?? tripKind}</p>
      <LegRow
        label="Туди"
        fromCity={outbound.fromCity}
        toCity={outbound.toCity}
        date={outbound.date}
        seatNumber={outbound.seatNumber}
        hasAssignedSeats={outbound.hasAssignedSeats}
        onSeat={openOutbound}
        onDate={openOutbound}
      />
      {tripKind !== "ONE_WAY" ? (
        openReturn ? (
          <button
            type="button"
            onClick={() => openReturnLeg(() => setDateModal("return"))}
            className="w-full rounded-xl border border-dashed border-brand-300 bg-brand-50 px-4 py-3 text-left text-sm text-brand-800"
          >
            Зворотня поїздка: відкрита дата — натисніть, щоб обрати рейс і місце
          </button>
        ) : returnLeg ? (
          <LegRow
            label="Назад"
            fromCity={returnLeg.fromCity}
            toCity={returnLeg.toCity}
            date={returnLeg.date}
            seatNumber={returnLeg.seatNumber}
            hasAssignedSeats={returnLeg.hasAssignedSeats}
            onSeat={() => openReturnLeg(() => returnLeg.tripId && setSeatModal("return"))}
            onDate={() => openReturnLeg(() => setDateModal("return"))}
          />
        ) : null
      ) : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}

      {seatModal === "return" && returnLeg?.tripId ? (
        <SeatPickerModal
          tripId={returnLeg.tripId}
          exceptTicketId={ticketId}
          initialSeat={returnLeg.seatNumber}
          title="Нове місце (назад)"
          onClose={() => setSeatModal(null)}
          onSave={async (seatNumber) => {
            await patch(`/api/account/tickets/${ticketId}/seat`, {
              seatNumber,
              leg: "return",
            });
            setSeatModal(null);
          }}
        />
      ) : null}
      {dateModal === "outbound" && outbound.fromCity ? (
        <TripChangeModal
          fromCity={outbound.fromCity}
          toCity={outbound.toCity}
          initialDate={outbound.date ?? toIsoDate(new Date())}
          exceptTicketId={ticketId}
          title="Дата виїзду і місце"
          confirmLabel="Зберегти"
          carrier={carrier}
          currentTripId={outbound.tripId}
          currentDeparture={departureTime}
          initialSeat={outbound.seatNumber}
          onClose={() => setDateModal(null)}
          onSave={async (tripId, seatNumber, date) => {
            const result =
              !carrier && tripId === outbound.tripId
                ? await patch(`/api/account/tickets/${ticketId}/seat`, { seatNumber, leg: "outbound" })
                : await patch(`/api/account/tickets/${ticketId}/trip`, { tripId, seatNumber, date });
            setDateModal(null);
            if (result.price != null && result.oldPrice != null && result.price !== result.oldPrice) {
              setNotice(`Квиток перенесено. Ціна за новим рейсом: €${result.price.toFixed(2)} (було €${result.oldPrice.toFixed(2)}).`);
            } else setNotice("Квиток перенесено.");
          }}
        />
      ) : null}
      {dateModal === "return" ? (
        <TripChangeModal
          fromCity={outbound.toCity}
          toCity={outbound.fromCity}
          initialDate={
            returnLeg?.date ??
            (outbound.date
              ? toIsoDate(addUtcDays(utcDateOnly(outbound.date), 2))
              : toIsoDate(new Date()))
          }
          exceptTicketId={ticketId}
          title="Обрати зворотній рейс"
          confirmLabel="Зберегти повернення"
          onClose={() => setDateModal(null)}
          onSave={async (tripId, seatNumber) => {
            await patch(`/api/account/tickets/${ticketId}/return`, {
              tripId,
              seatNumber,
            });
            setDateModal(null);
          }}
        />
      ) : null}
    </div>
  );
}

function LegRow({
  label,
  fromCity,
  toCity,
  date,
  seatNumber,
  hasAssignedSeats,
  onSeat,
  onDate,
}: {
  label: string;
  fromCity: string;
  toCity: string;
  date: string | null;
  seatNumber: number | null;
  hasAssignedSeats: boolean;
  onSeat: () => void;
  onDate: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="text-xs font-semibold uppercase text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">
        {fromCity} → {toCity}
      </span>
      <button type="button" onClick={onDate} className="text-sm text-brand-700 underline">
        {date ? formatUkDate(date) : "дата"}
      </button>
      {hasAssignedSeats ? (
        <button
          type="button"
          onClick={onSeat}
          className="rounded-lg bg-white px-2 py-1 text-sm font-semibold text-brand-800 ring-1 ring-brand-200"
        >
          {seatNumber != null ? `Місце ${seatNumber}` : "Обрати місце"}
        </button>
      ) : (
        <span className="text-xs text-slate-500">без місць</span>
      )}
    </div>
  );
}
