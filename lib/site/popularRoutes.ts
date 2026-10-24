import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { priceForTrip } from "@/lib/pricing/grid";
import { findSegmentTrips } from "@/lib/trips/segments";

/** Routes shown in «Популярні напрямки» and as quick picks under the search. */
export const POPULAR_ROUTES: { from: string; to: string }[] = [
  { from: "Барселона", to: "Київ" },
  { from: "Барселона", to: "Львів" },
  { from: "Валенсія", to: "Київ" },
  { from: "Мадрид", to: "Варшава" },
  { from: "Київ", to: "Берлін" },
  { from: "Київ", to: "Марбелья" },
];

/** How many of them appear as chips under the search form (from the brief). */
export const QUICK_ROUTES = POPULAR_ROUTES.slice(0, 4);

export type RouteStats = {
  from: string;
  to: string;
  /** Cheapest adult fare among upcoming trips, EUR; null = no schedule yet. */
  priceFrom: number | null;
  /** Typical journey time, whole hours. */
  hours: number | null;
  /** Departures per week over the window; ≥7 shows as «щодня». */
  perWeek: number;
};

const WINDOW_DAYS = 60;
const PRICED_SAMPLE = 30;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function computeStats(from: string, to: string): Promise<RouteStats> {
  const start = new Date();
  const end = new Date(start.getTime() + WINDOW_DAYS * 86_400_000);
  const options = (
    await findSegmentTrips({ fromCity: from, toCity: to, date: isoDay(start), until: isoDay(end) })
  ).filter((o) => new Date(o.departureTime) > start);

  if (options.length === 0) return { from, to, priceFrom: null, hours: null, perWeek: 0 };

  const sample = options.slice(0, PRICED_SAMPLE);
  const prices = await Promise.all(
    sample.map((o) =>
      priceForTrip(prisma, { id: o.tripId, price: 0, departureTime: new Date(o.departureTime) })
        .then((p) => p.price)
        .catch(() => 0)
    )
  );
  const positive = prices.filter((p) => p > 0);
  const durations = options
    .map((o) => (new Date(o.arrivalTime).getTime() - new Date(o.departureTime).getTime()) / 3_600_000)
    .filter((h) => h > 0)
    .sort((a, b) => a - b);
  const median = durations.length ? durations[Math.floor(durations.length / 2)] : null;

  return {
    from,
    to,
    priceFrom: positive.length ? Math.min(...positive) : null,
    hours: median ? Math.round(median) : null,
    perWeek: Math.round((options.length / WINDOW_DAYS) * 7),
  };
}

/** Live «від» price, duration and frequency per popular route (cached 15 min). */
export const getPopularRouteStats = unstable_cache(
  async (): Promise<RouteStats[]> =>
    Promise.all(
      POPULAR_ROUTES.map((r) =>
        computeStats(r.from, r.to).catch(() => ({ from: r.from, to: r.to, priceFrom: null, hours: null, perWeek: 0 }))
      )
    ),
  ["popular-route-stats-v1"],
  { revalidate: 900 }
);
