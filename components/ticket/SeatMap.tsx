"use client";

import { useMemo } from "react";
import { findSeat, seatLabels, type BusLayout, type Seat } from "@/lib/seats";

type DisplayStatus = "AVAILABLE" | "SELECTED" | "OCCUPIED";

export default function SeatMap({
  layout,
  selectedSeatNumber,
  onSelect,
}: {
  layout: BusLayout;
  selectedSeatNumber: number | null;
  onSelect: (seatNumber: number | null) => void;
}) {
  const rows = useMemo(() => {
    const byRow = new Map<number, Seat[]>();
    for (const seat of layout.seats) {
      const list = byRow.get(seat.row) ?? [];
      list.push(seat);
      byRow.set(seat.row, list);
    }
    return Array.from(byRow.entries()).sort(([a], [b]) => a - b);
  }, [layout.seats]);

  const selectedSeat = findSeat(layout, selectedSeatNumber);

  if (!layout.hasAssignedSeats) {
    return (
      <p className="text-sm text-slate-500">
        На цьому виїзді місця не призначаються.
      </p>
    );
  }

  const toggle = (seat: Seat) => {
    if (seat.status === "OCCUPIED") return;
    onSelect(seat.number === selectedSeatNumber ? null : seat.number);
  };

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Водій
          </p>
          <div className="space-y-1.5" role="group" aria-label="Схема місць">
            {rows.map(([rowNumber, seatsInRow]) => {
              const left = seatsInRow
                .filter((s) => s.side === "left")
                .sort((a, b) => a.number - b.number);
              const right = seatsInRow
                .filter((s) => s.side === "right")
                .sort((a, b) => a.number - b.number);
              const isLast = rowNumber === layout.rows;
              return (
                <div
                  key={rowNumber}
                  className="grid grid-cols-[1fr_16px_1fr] items-center gap-1"
                >
                  <div className="flex justify-end gap-1">
                    {left.map((seat) => (
                      <SeatButton
                        key={seat.number}
                        seat={seat}
                        status={
                          seat.status === "OCCUPIED"
                            ? "OCCUPIED"
                            : seat.number === selectedSeatNumber
                              ? "SELECTED"
                              : "AVAILABLE"
                        }
                        onToggle={toggle}
                      />
                    ))}
                  </div>
                  <div className="h-px bg-slate-200" />
                  <div className="flex justify-start gap-1">
                    {isLast && layout.hasToilet ? (
                      <span className="flex h-8 items-center rounded bg-slate-200 px-2 text-[10px] text-slate-500">
                        WC
                      </span>
                    ) : (
                      right.map((seat) => (
                        <SeatButton
                          key={seat.number}
                          seat={seat}
                          status={
                            seat.status === "OCCUPIED"
                              ? "OCCUPIED"
                              : seat.number === selectedSeatNumber
                                ? "SELECTED"
                                : "AVAILABLE"
                          }
                          onToggle={toggle}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="w-full space-y-3 lg:w-52">
          <div className="space-y-1 text-xs text-slate-600">
            <p className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-white ring-1 ring-slate-300" /> Вільне
            </p>
            <p className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-brand-600" /> Вибране
            </p>
            <p className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-slate-300" /> Зайняте
            </p>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
              Ваше місце
            </p>
            {selectedSeat ? (
              <>
                <p className="mt-1 text-xl font-bold text-brand-900">
                  № {selectedSeat.number}
                </p>
                <p className="text-xs text-brand-800">
                  {seatLabels(selectedSeat).sideLabel},{" "}
                  {seatLabels(selectedSeat).positionLabel}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-brand-800/70">Ще не вибрано</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SeatButton({
  seat,
  status,
  onToggle,
}: {
  seat: Seat;
  status: DisplayStatus;
  onToggle: (seat: Seat) => void;
}) {
  return (
    <button
      type="button"
      disabled={status === "OCCUPIED"}
      onClick={() => onToggle(seat)}
      className={`flex h-8 w-8 items-center justify-center rounded text-[11px] font-semibold ${
        status === "OCCUPIED"
          ? "cursor-not-allowed bg-slate-300 text-slate-500"
          : status === "SELECTED"
            ? "bg-brand-600 text-white"
            : "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-brand-50"
      }`}
      aria-label={`Місце ${seat.number}`}
    >
      {seat.number}
    </button>
  );
}
