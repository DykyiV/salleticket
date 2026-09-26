"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import BookingForm from "@/components/BookingForm";
import SeatMap from "@/components/SeatMap";
import { formatDuration } from "@/lib/mockTrips";
import { findSeat, seatLabels, type BusLayout } from "@/lib/seats";

type TripSummary = {
  carrier: string;
  carrierId: string;
  tripId?: string;
  from: string;
  to: string;
  date?: string;
  departure: string;
  arrival: string;
  duration: number;
  price: number;
  total: number;
};

type CurrentUser = { id: string; email: string; role: string } | null;

type Step = "seat" | "passenger";

function formatDate(dateStr?: string): string {
  if (!dateStr) return "Any date";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Owns the "choose a seat" → "passenger details" steps of /booking. The page
 * itself (app/booking/page.tsx) stays a server component that resolves
 * search params and the (mock) seat layout; this client component only adds
 * a step in front of the pre-existing BookingForm, without changing how that
 * form talks to /api/booking.
 */
export default function BookingFlow({
  tripSummary,
  currentUser,
  seatLayout,
}: {
  tripSummary: TripSummary;
  currentUser: CurrentUser;
  seatLayout: BusLayout;
}) {
  const [step, setStep] = useState<Step>("seat");
  const [selectedSeatNumber, setSelectedSeatNumber] = useState<number | null>(
    null
  );

  const selectedSeat = findSeat(seatLayout, selectedSeatNumber);
  const serviceFee = tripSummary.total - tripSummary.price;

  return (
    <>
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-6 sm:px-6 lg:px-8">
          {step === "seat" ? (
            <Link
              href="/results"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              aria-label="Back to results"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setStep("seat")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              aria-label="Back to seat selection"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Complete your booking
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {step === "seat"
                ? "Step 2 of 3 · Choose your seat"
                : "Step 3 of 3 · Passenger details"}
            </p>
          </div>
        </div>
      </section>

      <main className="flex-1 bg-slate-50">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
          <AnimatePresence mode="wait">
            {step === "seat" ? (
              <motion.div
                key="seat"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <SeatMap
                  layout={seatLayout}
                  selectedSeatNumber={selectedSeatNumber}
                  onSelect={setSelectedSeatNumber}
                />
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={!selectedSeat}
                    onClick={() => setStep("passenger")}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    Продовжити
                    <ArrowRightIcon className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="passenger"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {selectedSeat ? (
                  <SelectedSeatChip
                    seat={selectedSeat}
                    onChangeSeat={() => setStep("seat")}
                  />
                ) : null}
                <BookingForm
                  tripSummary={tripSummary}
                  currentUser={currentUser}
                  selectedSeat={
                    selectedSeat
                      ? {
                          number: selectedSeat.number,
                          side: selectedSeat.side,
                          position: selectedSeat.position,
                        }
                      : null
                  }
                />
              </motion.div>
            )}
          </AnimatePresence>

          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Your trip
                </p>
                <p className="mt-1 text-base font-semibold text-slate-900">
                  {tripSummary.carrier}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDate(tripSummary.date)}
                </p>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-3">
                  <div className="min-w-0">
                    <p className="text-xl font-bold tabular-nums text-slate-900">
                      {tripSummary.departure}
                    </p>
                    <p className="truncate text-xs font-medium text-slate-500">
                      {tripSummary.from}
                    </p>
                  </div>
                  <div className="flex flex-1 flex-col items-center">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      {formatDuration(tripSummary.duration)}
                    </span>
                    <div className="mt-1 flex w-full items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                      <span className="h-px flex-1 bg-gradient-to-r from-brand-500 via-brand-300 to-brand-500" />
                      <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                    </div>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-xl font-bold tabular-nums text-slate-900">
                      {tripSummary.arrival}
                    </p>
                    <p className="truncate text-xs font-medium text-slate-500">
                      {tripSummary.to}
                    </p>
                  </div>
                </div>
              </div>

              {selectedSeat ? (
                <div className="border-t border-dashed border-slate-200 p-5 text-sm">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Seat</span>
                    <span className="font-semibold text-slate-900">
                      #{selectedSeat.number}
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="border-t border-dashed border-slate-200 p-5 text-sm">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Ticket (1 passenger)</span>
                  <span className="tabular-nums">
                    €{tripSummary.price.toFixed(2)}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-slate-600">
                  <span>Service fee</span>
                  <span className="tabular-nums">€{serviceFee.toFixed(2)}</span>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="text-sm font-semibold text-slate-900">
                    Total
                  </span>
                  <span className="text-xl font-extrabold tracking-tight text-slate-900 tabular-nums">
                    €{tripSummary.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-3 px-1 text-xs text-slate-400">
              No real payment is processed — this is a demo booking flow.
            </p>
          </aside>
        </div>
      </main>
    </>
  );
}

function SelectedSeatChip({
  seat,
  onChangeSeat,
}: {
  seat: { number: number; side: "left" | "right"; position: "window" | "aisle" };
  onChangeSeat: () => void;
}) {
  const { sideLabel, positionLabel } = seatLabels(seat);
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
      <span>
        <span className="font-semibold">Місце {seat.number}</span> ·{" "}
        {sideLabel} · {positionLabel}
      </span>
      <button
        type="button"
        onClick={onChangeSeat}
        className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 transition hover:bg-brand-100"
      >
        Змінити місце
      </button>
    </div>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
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
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
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
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
