"use client";

import { useMemo } from "react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import { findSeat, seatLabels, type BusLayout, type Seat } from "@/lib/seats";

type DisplayStatus = "AVAILABLE" | "SELECTED" | "OCCUPIED";

type Props = {
  layout: BusLayout;
  selectedSeatNumber: number | null;
  onSelect: (seatNumber: number | null) => void;
};

function displayStatus(
  seat: Seat,
  selectedSeatNumber: number | null
): DisplayStatus {
  if (seat.status === "OCCUPIED") return "OCCUPIED";
  if (seat.number === selectedSeatNumber) return "SELECTED";
  return "AVAILABLE";
}

/**
 * Schematic isometric-ish bus seat map. Pure CSS 3D (a static perspective
 * tilt via `<style jsx>`, no Three.js) + `motion/react` for the interactive
 * bits — seat select/deselect, the info panel, and the row coming gently
 * into focus around the chosen seat.
 *
 * Data comes from `lib/seats.ts` (`getSeatLayout`), currently a deterministic
 * mock; swap that module for a real seat-inventory fetch later without
 * touching this component.
 */
export default function SeatMap({ layout, selectedSeatNumber, onSelect }: Props) {
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

  const handleToggle = (seat: Seat) => {
    if (seat.status === "OCCUPIED") return;
    onSelect(seat.number === selectedSeatNumber ? null : seat.number);
  };

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-slate-900">
            Виберіть місце
          </h2>
          <p className="text-sm text-slate-500">
            Торкніться вільного крісла на схемі салону, щоб вибрати його.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_260px]">
          <div className="bus-scene-wrap">
            <div className="bus-scene">
              <BusFront />

              <div
                className="bus-rows"
                role="group"
                aria-label="Схема місць в автобусі"
              >
                {rows.map(([rowNumber, seatsInRow]) => {
                  const left = seatsInRow
                    .filter((s) => s.side === "left")
                    .sort((a, b) => a.number - b.number);
                  const right = seatsInRow
                    .filter((s) => s.side === "right")
                    .sort((a, b) => a.number - b.number);
                  const isLastRow = rowNumber === layout.rows;
                  const focused = selectedSeat?.row === rowNumber;

                  return (
                    <motion.div
                      key={rowNumber}
                      className="bus-row"
                      animate={{ scale: focused ? 1.03 : 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 22 }}
                    >
                      <div className="seat-group">
                        {left.map((seat) => (
                          <SeatButton
                            key={seat.number}
                            seat={seat}
                            status={displayStatus(seat, selectedSeatNumber)}
                            onToggle={handleToggle}
                          />
                        ))}
                      </div>

                      <div className="aisle" aria-hidden="true" />

                      <div className="seat-group">
                        {isLastRow && layout.hasToilet ? (
                          <Toilet />
                        ) : (
                          right.map((seat) => (
                            <SeatButton
                              key={seat.number}
                              seat={seat}
                              status={displayStatus(seat, selectedSeatNumber)}
                              onToggle={handleToggle}
                            />
                          ))
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <BusRear />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <Legend />
            <SeatInfoPanel seat={selectedSeat} />
          </div>
        </div>

        <style jsx>{`
          .bus-scene-wrap {
            perspective: 1400px;
            padding: 4px 0 12px;
          }
          .bus-scene {
            transform: rotateX(7deg);
            transform-style: preserve-3d;
            border-radius: 28px;
            background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
            border: 1px solid #e2e8f0;
            padding: 20px 14px 26px;
            box-shadow: 0 30px 60px -30px rgba(15, 23, 42, 0.28);
          }
          .bus-rows {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-top: 14px;
          }
          .bus-row {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            align-items: center;
            gap: 8px;
          }
          .seat-group {
            display: flex;
            justify-content: center;
            gap: 8px;
            min-width: 100px;
          }
          .aisle {
            width: 22px;
            height: 2px;
            justify-self: center;
            background: repeating-linear-gradient(
              to right,
              #cbd5e1 0,
              #cbd5e1 4px,
              transparent 4px,
              transparent 9px
            );
          }
          @media (max-width: 480px) {
            .bus-scene {
              transform: none;
              padding: 16px 8px 20px;
            }
            .seat-group {
              min-width: 88px;
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .bus-scene {
              transform: none;
            }
          }
        `}</style>
      </motion.div>
    </MotionConfig>
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
  const { sideLabel, positionLabel } = seatLabels(seat);
  const statusLabel =
    status === "OCCUPIED"
      ? "зайняте"
      : status === "SELECTED"
        ? "вибране"
        : "вільне";

  return (
    <motion.button
      type="button"
      disabled={status === "OCCUPIED"}
      onClick={() => onToggle(seat)}
      whileTap={status !== "OCCUPIED" ? { scale: 0.9 } : undefined}
      animate={{ scale: status === "SELECTED" ? 1.12 : 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 18 }}
      aria-pressed={status === "SELECTED"}
      aria-label={`Місце ${seat.number}, ${sideLabel.toLowerCase()}, ${positionLabel.toLowerCase()}, ${statusLabel}`}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 sm:h-10 sm:w-10 ${
        status === "OCCUPIED"
          ? "cursor-not-allowed bg-slate-200 text-slate-400"
          : status === "SELECTED"
            ? "bg-brand-600 text-white shadow-md shadow-brand-600/30"
            : "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-brand-50 hover:ring-brand-300"
      }`}
    >
      {seat.number}
    </motion.button>
  );
}

function Legend() {
  const items: { label: string; swatch: string }[] = [
    { label: "Вільне", swatch: "bg-white ring-1 ring-inset ring-slate-300" },
    { label: "Вибране", swatch: "bg-brand-600" },
    { label: "Зайняте", swatch: "bg-slate-300" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600 lg:flex-col lg:items-start lg:gap-2.5">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-2">
          <span
            className={`h-3 w-3 shrink-0 rounded-full ${item.swatch}`}
            aria-hidden="true"
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function SeatInfoPanel({ seat }: { seat: Seat | null }) {
  const labels = seat ? seatLabels(seat) : null;
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
        Ваше місце
      </p>
      <AnimatePresence mode="wait">
        {seat && labels ? (
          <motion.div
            key={seat.number}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="mt-2"
          >
            <p className="text-2xl font-bold tracking-tight text-brand-900">
              Місце {seat.number}
            </p>
            <p className="mt-1 text-sm text-brand-800">{labels.sideLabel}</p>
            <p className="text-sm text-brand-800">{labels.positionLabel}</p>
          </motion.div>
        ) : (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 text-sm text-brand-800/70"
          >
            Місце ще не вибрано
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function BusFront() {
  return (
    <div
      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:px-4"
      aria-hidden="true"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-white">
          <SteeringWheelIcon className="h-4 w-4" />
        </span>
        <span className="hidden text-[11px] font-medium uppercase tracking-wide text-slate-400 sm:inline">
          Водій
        </span>
      </div>
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        Лобове скло
      </span>
      <div className="flex items-center gap-2">
        <span className="hidden text-[11px] font-medium uppercase tracking-wide text-slate-400 sm:inline">
          Двері
        </span>
        <span className="flex h-8 w-6 shrink-0 items-center justify-center rounded-md border-2 border-dashed border-slate-300 text-slate-400">
          <DoorIcon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function BusRear() {
  return (
    <div
      className="mt-4 flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-2"
      aria-hidden="true"
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        Задня частина
      </span>
    </div>
  );
}

function Toilet() {
  return (
    <div
      className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-100 text-[10px] font-medium uppercase tracking-wide text-slate-400 sm:h-10"
      aria-hidden="true"
      title="Туалет"
    >
      <ToiletIcon className="h-4 w-4" />
      WC
    </div>
  );
}

function SteeringWheelIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 3v6.5M4.2 17.5 9.7 14M19.8 17.5 14.3 14" />
    </svg>
  );
}

function DoorIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 3h12v18H6z" />
      <path d="M6 12h12" />
    </svg>
  );
}

function ToiletIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M7 4h10v6a5 5 0 0 1-10 0V4z" />
      <path d="M9 15v2a3 3 0 0 0 6 0v-2" />
      <path d="M9 20h6" />
    </svg>
  );
}
