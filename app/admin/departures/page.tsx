import Link from "next/link";
import Header from "@/components/Header";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const eur = (n: number) => `€${n.toFixed(2)}`;

const TRANSPORT_LABELS: Record<string, string> = {
  BUS: "Bus",
  FLIGHT: "Flight",
  TRAIN: "Train",
};

const SORTS: Record<string, { label: string; orderBy: Prisma.TripOrderByWithRelationInput[] }> = {
  dep_asc: { label: "Час виїзду ↑", orderBy: [{ departureTime: "asc" }] },
  dep_desc: { label: "Час виїзду ↓", orderBy: [{ departureTime: "desc" }] },
  price_asc: { label: "Вартість ↑", orderBy: [{ price: "asc" }] },
  price_desc: { label: "Вартість ↓", orderBy: [{ price: "desc" }] },
};

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export default async function DeparturesPage(
  props: {
    searchParams: Promise<{
      q?: string;
      country?: string;
      carrier?: string;
      from?: string;
      to?: string;
      sort?: string;
    }>;
  }
) {
  const searchParams = await props.searchParams;
  const q = (searchParams.q ?? "").trim();
  const country = (searchParams.country ?? "").trim();
  const carrier = (searchParams.carrier ?? "").trim();
  const sort = SORTS[searchParams.sort ?? ""] ? searchParams.sort! : "dep_asc";

  // Display period: default — from today one month ahead.
  const now = new Date();
  const defaultFrom = isoDay(now);
  const defaultTo = isoDay(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000));
  const from = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.from ?? "")
    ? searchParams.from!
    : defaultFrom;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.to ?? "")
    ? searchParams.to!
    : defaultTo;
  const periodStart = new Date(`${from}T00:00:00.000Z`);
  const periodEnd = new Date(`${to}T23:59:59.999Z`);

  const where: Prisma.TripWhereInput = {
    departureTime: { gte: periodStart, lte: periodEnd },
    ...(country ? { toCountry: country } : {}),
    ...(carrier ? { carrier: { name: carrier } } : {}),
    ...(q
      ? {
          OR: [
            { fromCity: { contains: q } },
            { toCity: { contains: q } },
          ],
        }
      : {}),
  };

  const [trips, carriers, countriesRaw] = await Promise.all([
    prisma.trip.findMany({
      where,
      include: {
        carrier: { select: { name: true } },
        tickets: {
          where: { status: { notIn: ["CANCELLED", "REFUNDED"] } },
          select: { finalPrice: true },
        },
      },
      orderBy: SORTS[sort].orderBy,
      take: 300,
    }),
    prisma.carrier.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    prisma.trip.findMany({
      where: { toCountry: { not: "" } },
      select: { toCountry: true },
      distinct: ["toCountry"],
      orderBy: { toCountry: "asc" },
    }),
  ]);
  const countries = countriesRaw.map((c) => c.toCountry);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
            ADMIN
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            Departures
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            All departures in the selected period (default — one month ahead).
            Open a departure to see its passengers.
          </p>

          <form
            method="GET"
            action="/admin/departures"
            className="mt-5 flex flex-wrap items-center gap-2"
          >
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Пошук за містами…"
              className="w-52 rounded-xl border-0 px-3.5 py-2 text-sm text-slate-900 ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-500"
            />
            <select
              name="country"
              defaultValue={country}
              className="rounded-xl border-0 bg-white px-3.5 py-2 text-sm text-slate-700 ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Всі країни</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              name="carrier"
              defaultValue={carrier}
              className="rounded-xl border-0 bg-white px-3.5 py-2 text-sm text-slate-700 ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Всі перевізники</option>
              {carriers.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              від
              <input
                type="date"
                name="from"
                defaultValue={from}
                className="rounded-xl border-0 bg-white px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-500"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              до
              <input
                type="date"
                name="to"
                defaultValue={to}
                className="rounded-xl border-0 bg-white px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-500"
              />
            </label>
            <select
              name="sort"
              defaultValue={sort}
              className="rounded-xl border-0 bg-white px-3.5 py-2 text-sm text-slate-700 ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-500"
            >
              {Object.entries(SORTS).map(([value, s]) => (
                <option key={value} value={value}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Показати
            </button>
          </form>

          <div className="mt-6 overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Маршрут</Th>
                  <Th>Виїзд</Th>
                  <Th>Тип</Th>
                  <Th>Перевізник</Th>
                  <Th>Країна</Th>
                  <Th className="text-right">Ціна</Th>
                  <Th className="text-right">Квитків</Th>
                  <Th className="text-right">Виручка</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trips.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                      No departures in this period.
                    </td>
                  </tr>
                ) : (
                  trips.map((trip) => {
                    const revenue = trip.tickets.reduce((s, t) => s + t.finalPrice, 0);
                    return (
                      <tr key={trip.id} className="transition hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {trip.fromCity} → {trip.toCity}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/departures/${trip.id}`}
                            className="font-medium text-brand-700 hover:underline"
                          >
                            {trip.departureTime.toISOString().slice(0, 16).replace("T", " ")}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {TRANSPORT_LABELS[trip.transportType] ?? trip.transportType}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{trip.carrier.name}</td>
                        <td className="px-4 py-3 text-slate-600">{trip.toCountry || "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                          {eur(trip.price)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                          {trip.tickets.length}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                          {eur(revenue)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${className}`}
    >
      {children}
    </th>
  );
}
