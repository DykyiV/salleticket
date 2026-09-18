import Link from "next/link";
import Header from "@/components/Header";
import BookingForm from "@/components/BookingForm";
import LegalLinks from "@/components/booking/LegalLinks";
import { formatDuration } from "@/lib/mockTrips";
import { getCurrentUser } from "@/lib/auth/session";
import { parseTripKind } from "@/lib/tickets/kinds";
import { TRIP_KIND_LABEL } from "@/lib/tickets/labels";

export const dynamic = "force-dynamic";

type SearchParams = {
  carrier?: string;
  carrierId?: string;
  tripId?: string;
  from?: string;
  to?: string;
  date?: string;
  departure?: string;
  arrival?: string;
  duration?: string;
  price?: string;
  tripKind?: string;
  returnDate?: string;
  returnTripId?: string;
  returnPrice?: string;
  seats?: string;
  returnSeats?: string;
  passengers?: string;
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

function parseSeats(raw?: string): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => Number.parseInt(v, 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 46);
}

export default async function BookingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await getCurrentUser();

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
  const tripKind = parseTripKind(searchParams.tripKind);
  const returnDate = searchParams.returnDate;
  const returnPrice = searchParams.returnPrice
    ? Number.parseFloat(searchParams.returnPrice)
    : 0;
  const seats = parseSeats(searchParams.seats);
  const returnSeats = parseSeats(searchParams.returnSeats);
  const passengersCount = searchParams.passengers
    ? Math.max(1, Number.parseInt(searchParams.passengers, 10) || 1)
    : Math.max(1, seats.length);

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
              Дані пасажирів
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {TRIP_KIND_LABEL[tripKind]} · {passengersCount}{" "}
              {passengersCount === 1
                ? "пасажир"
                : passengersCount <= 4
                  ? "пасажири"
                  : "пасажирів"}
              {seats.length > 0 ? ` · місця ${seats.join(", ")}` : ""}
            </p>
          </div>
        </div>
      </section>

      <main className="flex-1 bg-slate-50">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
          <BookingForm
            tripSummary={{
              carrier,
              carrierId: searchParams.carrierId ?? "mock",
              tripId: searchParams.tripId,
              from,
              to,
              date,
              departure,
              arrival,
              price,
              total: price + 1.5,
            }}
            currentUser={
              user
                ? { id: user.id, email: user.email, role: user.role }
                : null
            }
            tripKind={tripKind}
            returnDate={returnDate}
            seats={seats}
            returnSeats={returnSeats}
            returnTripId={searchParams.returnTripId}
            returnPrice={returnPrice}
            passengersCount={passengersCount}
          />

          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ваша поїздка
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

                {tripKind === "ROUND_TRIP" && returnDate ? (
                  <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Назад: {to} → {from} · {formatDate(returnDate)}
                    {returnSeats.length > 0
                      ? ` · місця ${returnSeats.join(", ")}`
                      : ""}
                  </p>
                ) : null}
                {tripKind === "OPEN_RETURN" ? (
                  <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
                    Зворотня поїздка з відкритою датою — оберете пізніше в
                    квитку.
                  </p>
                ) : null}
              </div>

              <div className="border-t border-dashed border-slate-200 p-5 text-sm">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Базова ціна (пасажир)</span>
                  <span className="tabular-nums">€{price.toFixed(2)}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-slate-600">
                  <span>Пасажирів</span>
                  <span className="tabular-nums">{passengersCount}</span>
                </div>
                {seats.length > 0 ? (
                  <div className="mt-1.5 flex items-center justify-between text-slate-600">
                    <span>Місця</span>
                    <span className="tabular-nums">{seats.join(", ")}</span>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-slate-200 p-5">
                <LegalLinks />
              </div>
            </div>

            <p className="mt-3 px-1 text-xs text-slate-400">
              Демо — реальна оплата не проводиться.
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
