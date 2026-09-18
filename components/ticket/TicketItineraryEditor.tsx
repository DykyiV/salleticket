"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import SeatPickerModal from "@/components/ticket/SeatPickerModal";
import TripChangeModal from "@/components/ticket/TripChangeModal";
import { formatUkDate, toIsoDate } from "@/lib/routes/dates";
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
}: {
  ticketId: string;
  tripKind: string;
  outbound: Leg;
  returnLeg: Leg | null;
}) {
  const router = useRouter();
  const [seatModal, setSeatModal] = useState<"outbound" | "return" | null>(null);
  const [dateModal, setDateModal] = useState<"outbound" | "return" | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        onSeat={() => outbound.tripId && setSeatModal("outbound")}
        onDate={() => setDateModal("outbound")}
      />
      {tripKind !== "ONE_WAY" ? (
        openReturn ? (
          <button
            type="button"
            onClick={() => setDateModal("return")}
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
            onSeat={() => returnLeg.tripId && setSeatModal("return")}
            onDate={() => setDateModal("return")}
          />
        ) : null
      ) : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      {seatModal === "outbound" && outbound.tripId ? (
        <SeatPickerModal
          tripId={outbound.tripId}
          exceptTicketId={ticketId}
          initialSeat={outbound.seatNumber}
          title="Нове місце (туди)"
          onClose={() => setSeatModal(null)}
          onSave={async (seatNumber) => {
            await patch(`/api/account/tickets/${ticketId}/seat`, {
              seatNumber,
              leg: "outbound",
            });
            setSeatModal(null);
          }}
        />
      ) : null}
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
          title="Змінити дату виїзду"
          confirmLabel="Зберегти рейс"
          onClose={() => setDateModal(null)}
          onSave={async (tripId, seatNumber) => {
            await patch(`/api/account/tickets/${ticketId}/trip`, {
              tripId,
              seatNumber,
            });
            setDateModal(null);
          }}
        />
      ) : null}
      {dateModal === "return" ? (
        <TripChangeModal
          fromCity={outbound.toCity}
          toCity={outbound.fromCity}
          initialDate={returnLeg?.date ?? toIsoDate(new Date())}
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
