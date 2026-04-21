import Link from "next/link";
import Header from "@/components/Header";
import BookingForm from "@/components/BookingForm";
import { formatDuration } from "@/lib/mockTrips";

type SearchParams = {
  carrier?: string;
  from?: string;
  to?: string;
  date?: string;
  departure?: string;
  arrival?: string;
  duration?: string;
  price?: string;
};

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

export default function BookingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const carrier = searchParams.carrier || "Grandes Tour";
  const from = searchParams.from || "Kyiv";
  const to = searchParams.to || "Lviv";
  const date = searchParams.date;
  const departure = searchParams.departure || "08:00";
  const arrival = searchParams.arrival || "14:50";
  const duration = searchParams.duration
    ? Number.parseInt(searchParams.duration, 10)
    : 410;
  const price = searchParams.price
    ? Number.parseFloat(searchParams.price)
    : 22.0;

  const serviceFee = 1.5;
  const total = price + serviceFee;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-6 sm:px-6 lg:px-8">
          <Link
            href="/results"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            aria-label="Back to results"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Complete your booking
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Step 2 of 3 · Passenger details
            </p>
          </div>
        </div>
      </section>

      <main className="flex-1 bg-slate-50">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
          <BookingForm
            tripSummary={{
              carrier,
              from,
              to,
              date,
              departure,
              arrival,
              price,
              total,
            }}
          />

          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Your trip
                </p>
                <p className="mt-1 text-base font-semibold text-slate-900">
                  {carrier}
                </p>
                <p className="text-xs text-slate-500">{formatDate(date)}</p>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-3">
                  <div className="min-w-0">
                    <p className="text-xl font-bold tabular-nums text-slate-900">
                      {departure}
                    </p>
                    <p className="truncate text-xs font-medium text-slate-500">
                      {from}
                    </p>
                  </div>
                  <div className="flex flex-1 flex-col items-center">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      {formatDuration(duration)}
                    </span>
                    <div className="mt-1 flex w-full items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                      <span className="h-px flex-1 bg-gradient-to-r from-brand-500 via-brand-300 to-brand-500" />
                      <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                    </div>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-xl font-bold tabular-nums text-slate-900">
                      {arrival}
                    </p>
                    <p className="truncate text-xs font-medium text-slate-500">
                      {to}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-200 p-5 text-sm">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Ticket (1 passenger)</span>
                  <span className="tabular-nums">€{price.toFixed(2)}</span>
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
                    €{total.toFixed(2)}
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

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-sm text-slate-500 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} Asol BUS. Demo booking — no real payment.
        </div>
      </footer>
    </div>
  );
}
