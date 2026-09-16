import Link from "next/link";
import Header from "@/components/Header";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const eur = (n: number) => `€${n.toFixed(2)}`;

const TRANSPORT_LABELS: Record<string, string> = {
  BUS: "Bus",
  FLIGHT: "Flight",
  TRAIN: "Train",
};

export default async function DeparturesPage() {
  const trips = await prisma.trip.findMany({
    include: {
      carrier: { select: { name: true } },
      tickets: {
        where: { status: { notIn: ["CANCELLED", "REFUNDED"] } },
        select: { finalPrice: true },
      },
    },
    orderBy: [{ fromCity: "asc" }, { toCity: "asc" }, { departureTime: "asc" }],
    take: 300,
  });

  // Group departures by route for the "список рейсів по напрямках" view.
  const byRoute = new Map<string, typeof trips>();
  for (const trip of trips) {
    const key = `${trip.fromCity} → ${trip.toCity}`;
    const group = byRoute.get(key) ?? [];
    group.push(trip);
    byRoute.set(key, group);
  }

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
            Trips by route. Open a departure to see every ticket sold on it
            and the per-ticket details.
          </p>

          <div className="mt-6 flex flex-col gap-6">
            {[...byRoute.entries()].map(([route, routeTrips]) => (
              <section
                key={route}
                className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200"
              >
                <h2 className="border-b border-slate-100 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-900">
                  {route}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {routeTrips.length} departure(s)
                  </span>
                </h2>
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {routeTrips.map((trip) => {
                      const revenue = trip.tickets.reduce(
                        (s, t) => s + t.finalPrice,
                        0
                      );
                      return (
                        <tr key={trip.id} className="transition hover:bg-slate-50">
                          <td className="px-5 py-3">
                            <Link
                              href={`/admin/departures/${trip.id}`}
                              className="font-medium text-brand-700 hover:underline"
                            >
                              {trip.departureTime
                                .toISOString()
                                .slice(0, 16)
                                .replace("T", " ")}
                            </Link>
                          </td>
                          <td className="px-5 py-3 text-slate-600">
                            {TRANSPORT_LABELS[trip.transportType] ?? trip.transportType}
                          </td>
                          <td className="px-5 py-3 text-slate-600">
                            {trip.carrier.name}
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                            {trip.tickets.length} ticket(s)
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums font-medium text-slate-900">
                            {eur(revenue)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            ))}

            {byRoute.size === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                No departures yet — they appear when tickets are booked.
              </p>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
