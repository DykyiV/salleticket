import Link from "next/link";
import type { Trip } from "@/lib/mockTrips";
import { formatDuration } from "@/lib/mockTrips";

type Props = {
  trip: Trip;
  date?: string;
};

function buildBookingHref(trip: Trip, date?: string): string {
  const params = new URLSearchParams({
    carrier: trip.carrier,
    from: trip.from,
    to: trip.to,
    departure: trip.departure,
    arrival: trip.arrival,
    duration: String(trip.durationMinutes),
    price: trip.price.toFixed(2),
  });
  if (date) params.set("date", date);
  return `/booking?${params.toString()}`;
}

export default function TripCard({ trip, date }: Props) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:shadow-lg hover:ring-brand-300 md:flex-row">
      <div className="flex flex-1 flex-col gap-5 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-sm font-bold text-brand-700 ring-1 ring-inset ring-brand-100">
              {trip.carrierShort}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {trip.carrier}
              </p>
              <p className="truncate text-xs text-slate-500">{trip.busType}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
            <StarIcon className="h-3.5 w-3.5 fill-current" />
            {trip.rating.toFixed(1)}
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <div className="min-w-0">
            <p className="text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
              {trip.departure}
            </p>
            <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
              {trip.from}
            </p>
          </div>

          <div className="flex flex-1 flex-col items-center">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {formatDuration(trip.durationMinutes)}
            </span>
            <div className="mt-1 flex w-full items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />
              <span className="h-px flex-1 bg-gradient-to-r from-brand-500 via-brand-300 to-brand-500" />
              <BusGlyph className="h-4 w-4 shrink-0 text-brand-500" />
              <span className="h-px flex-1 bg-gradient-to-r from-brand-500 via-brand-300 to-brand-500" />
              <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />
            </div>
            <span className="mt-1 text-[11px] text-slate-400">Direct</span>
          </div>

          <div className="min-w-0 text-right">
            <p className="text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
              {trip.arrival}
            </p>
            <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
              {trip.to}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {trip.amenities.map((a) => (
            <span
              key={a}
              className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600"
            >
              {a}
            </span>
          ))}
        </div>
      </div>

      <div className="relative hidden items-center md:flex" aria-hidden="true">
        <span className="absolute -top-3 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full bg-slate-50 ring-1 ring-slate-200" />
        <span className="absolute -bottom-3 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full bg-slate-50 ring-1 ring-slate-200" />
        <span
          className="block h-[70%] w-px"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, #cbd5e1 50%, transparent 50%)",
            backgroundSize: "1px 8px",
            backgroundRepeat: "repeat-y",
          }}
        />
      </div>

      <div className="relative flex items-center justify-between gap-4 border-t border-dashed border-slate-200 bg-slate-50/60 p-5 sm:p-6 md:w-56 md:flex-col md:items-stretch md:justify-center md:border-l md:border-t-0 md:text-center">
        <span className="absolute -left-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 rounded-full bg-slate-50 ring-1 ring-slate-200 md:block" />

        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            From
          </p>
          <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            €{trip.price.toFixed(2)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {trip.seatsLeft <= 5 ? (
              <span className="font-semibold text-rose-600">
                Only {trip.seatsLeft} seats left
              </span>
            ) : (
              <>{trip.seatsLeft} seats left</>
            )}
          </p>
        </div>

        <Link
          href={buildBookingHref(trip, date)}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
        >
          Book
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2.5l2.9 5.88 6.5.94-4.7 4.58 1.11 6.47L12 17.3l-5.81 3.06 1.11-6.47L2.6 9.32l6.5-.94L12 2.5z" />
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

function BusGlyph({ className }: { className?: string }) {
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
      <path d="M8 6v6" />
      <path d="M16 6v6" />
      <path d="M2 12h19.6" />
      <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2V6c0-1.1-.9-2-2-2H4a2 2 0 0 0-2 2v8c0 .5.2 1 .6 1.4L4 18" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}
