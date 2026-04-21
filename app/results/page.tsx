import Link from "next/link";
import Header from "@/components/Header";
import TripCard from "@/components/TripCard";
import { getMockTrips } from "@/lib/mockTrips";

type SearchParams = {
  from?: string;
  to?: string;
  date?: string;
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

export default function ResultsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const from = searchParams.from || "Kyiv";
  const to = searchParams.to || "Lviv";
  const date = searchParams.date;

  const trips = getMockTrips(from, to);
  const cheapest = trips.reduce(
    (min, t) => (t.price < min ? t.price : min),
    Infinity
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              aria-label="Back to search"
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
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                <span>{from}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 text-brand-500"
                  aria-hidden="true"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
                <span>{to}</span>
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                {formatDate(date)} · {trips.length} trips found · from{" "}
                <span className="font-semibold text-slate-900">
                  €{cheapest.toFixed(2)}
                </span>
              </p>
            </div>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
          >
            Edit search
          </Link>
        </div>
      </section>

      <main className="flex-1 bg-slate-50">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[240px_1fr] lg:px-8">
          <aside className="hidden lg:block">
            <div className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
              <div className="mt-4 space-y-4 text-sm">
                <FilterGroup title="Departure">
                  {["Morning", "Afternoon", "Evening", "Night"].map((l) => (
                    <CheckboxRow key={l} label={l} />
                  ))}
                </FilterGroup>
                <FilterGroup title="Carrier">
                  {["Grandes Tour", "Asol Express", "EuroLines Plus", "FlixBus"].map(
                    (l) => (
                      <CheckboxRow key={l} label={l} />
                    )
                  )}
                </FilterGroup>
                <FilterGroup title="Amenities">
                  {["Wi-Fi", "USB", "WC", "A/C"].map((l) => (
                    <CheckboxRow key={l} label={l} />
                  ))}
                </FilterGroup>
              </div>
              <p className="mt-5 text-xs text-slate-400">
                Filters are visual only — no backend yet.
              </p>
            </div>
          </aside>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Sorted by <span className="font-medium text-slate-700">departure time</span>
              </p>
              <div className="hidden items-center gap-2 text-xs sm:flex">
                {["Cheapest", "Fastest", "Earliest"].map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    className={`rounded-full px-3 py-1.5 font-medium transition ${
                      i === 2
                        ? "bg-brand-600 text-white"
                        : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-sm text-slate-500 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} Asol BUS. Mock results — no backend yet.
        </div>
      </footer>
    </div>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function CheckboxRow({ label }: { label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-slate-700 transition hover:bg-slate-50">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      <span>{label}</span>
    </label>
  );
}
