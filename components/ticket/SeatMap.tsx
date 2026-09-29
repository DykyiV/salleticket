"use client";

import { useMemo } from "react";
import {
  findSeat,
  seatLabels,
  type BusLayout,
  type LayoutCell,
  type Seat,
} from "@/lib/seats";

type DisplayStatus = "AVAILABLE" | "SELECTED" | "OCCUPIED" | "HELD";

function displayStatus(seat: Seat, selected: boolean): DisplayStatus {
  if (seat.status === "OCCUPIED") return "OCCUPIED";
  if (seat.status === "HELD") return "HELD";
  return selected ? "SELECTED" : "AVAILABLE";
}

export default function SeatMap({
  layout,
  selectedSeatNumber,
  selectedSeatNumbers,
  onSelect,
}: {
  layout: BusLayout;
  selectedSeatNumber?: number | null;
  /** Multi-select mode: list of currently chosen seats. */
  selectedSeatNumbers?: number[];
  onSelect: (seatNumber: number | null) => void;
}) {
  const multi = selectedSeatNumbers !== undefined;
  const selectedSet = useMemo(
    () => new Set(selectedSeatNumbers ?? []),
    [selectedSeatNumbers]
  );
  const isSelected = (n: number) =>
    multi ? selectedSet.has(n) : n === selectedSeatNumber;

  const selectedSeat = findSeat(layout, selectedSeatNumber ?? null);

  if (!layout.hasAssignedSeats) {
    return (
      <p className="text-sm text-slate-500">
        На цьому виїзді місця не призначаються.
      </p>
    );
  }

  const toggle = (seat: Seat) => {
    if (seat.status !== "AVAILABLE") return;
    if (!multi && seat.number === selectedSeatNumber) {
      onSelect(null);
      return;
    }
    onSelect(seat.number);
  };

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1 space-y-4">
          {layout.decks.map((deck, deckIndex) => (
            <div
              key={deck.name + deckIndex}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
            >
              <p className="mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-slate-400">
                <span>{deck.name}</span>
                <span>Водій · вперед ↑</span>
              </p>
              <div className="space-y-1.5" role="group" aria-label="Схема місць">
                {deck.rows.map((row, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="grid items-center gap-1"
                    style={{
                      gridTemplateColumns: `repeat(${row.length}, minmax(0,1fr))`,
                    }}
                  >
                    {row.map((cell, colIndex) => (
                      <Cell
                        key={colIndex}
                        cell={cell}
                        selected={cell.type === "seat" && isSelected(cell.seat.number)}
                        onToggle={toggle}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
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
            <p className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-amber-300" /> Бронь (інший пасажир)
            </p>
            <p className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-indigo-100 ring-1 ring-indigo-300" /> Спальне / ×ціна
            </p>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
              {multi ? "Ваші місця" : "Ваше місце"}
            </p>
            {multi ? (
              selectedSeatNumbers.length > 0 ? (
                <p className="mt-1 text-xl font-bold text-brand-900">
                  {[...selectedSeatNumbers].sort((a, b) => a - b).join(", ")}
                </p>
              ) : (
                <p className="mt-1 text-sm text-brand-800/70">Ще не вибрано</p>
              )
            ) : selectedSeat ? (
              <>
                <p className="mt-1 text-xl font-bold text-brand-900">
                  № {selectedSeat.number}
                </p>
                <p className="text-xs text-brand-800">
                  {seatLabels(selectedSeat).sideLabel},{" "}
                  {seatLabels(selectedSeat).positionLabel}
                  {selectedSeat.mult !== 1 ? ` · ×${selectedSeat.mult}` : ""}
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

function Cell({
  cell,
  selected,
  onToggle,
}: {
  cell: LayoutCell;
  selected: boolean;
  onToggle: (seat: Seat) => void;
}) {
  if (cell.type !== "seat") {
    const label =
      cell.type === "wc"
        ? "WC"
        : cell.type === "door"
          ? "Двері"
          : cell.type === "stairs"
            ? "Сходи"
            : "";
    return (
      <span className="flex h-8 items-center justify-center rounded bg-slate-200/70 text-[9px] font-medium uppercase text-slate-400">
        {label}
      </span>
    );
  }

  const seat = cell.seat;
  const status = displayStatus(seat, selected);
  const disabled = status === "OCCUPIED" || status === "HELD";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onToggle(seat)}
      title={`${seatLabels(seat).sideLabel}, ${seatLabels(seat).positionLabel}${seat.mult !== 1 ? ` · ×${seat.mult}` : ""}`}
      className={`flex h-8 w-full items-center justify-center rounded text-[11px] font-semibold ${
        status === "OCCUPIED"
          ? "cursor-not-allowed bg-slate-300 text-slate-500"
          : status === "HELD"
            ? "cursor-not-allowed bg-amber-300 text-amber-900"
            : status === "SELECTED"
              ? "bg-brand-600 text-white"
              : seat.kind !== "seat" || seat.mult !== 1
                ? "bg-indigo-100 text-indigo-900 ring-1 ring-inset ring-indigo-300 hover:bg-indigo-200"
                : "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-brand-50"
      }`}
      aria-label={`Місце ${seat.number}`}
    >
      {seat.number}
    </button>
  );
}
