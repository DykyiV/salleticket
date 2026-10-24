import type { Trip } from "@/lib/mockTrips";
import { BUS_FEATURES, type BusFeature } from "@/lib/buses/features";

/** Time-of-day buckets used by the departure / arrival filters. */
export const PERIODS = ["night", "morning", "day", "evening"] as const;
export type Period = (typeof PERIODS)[number];
export const PERIOD_RANGE: Record<Period, string> = {
  night: "00–06",
  morning: "06–12",
  day: "12–18",
  evening: "18–24",
};

export const SORTS = ["earliest", "price", "fastest", "seats"] as const;
export type SortKey = (typeof SORTS)[number];

export type Filters = {
  dep: Period[];
  arr: Period[];
  maxPrice: number | null;
  maxHours: number | null;
  stops: ("direct" | "transfer")[];
  categories: string[];
  carriers: string[];
  features: BusFeature[];
  minLuggage: number | null;
};

export const EMPTY_FILTERS: Filters = {
  dep: [],
  arr: [],
  maxPrice: null,
  maxHours: null,
  stops: [],
  categories: [],
  carriers: [],
  features: [],
  minLuggage: null,
};

export function periodOf(hhmm: string): Period {
  const h = Number(hhmm.slice(0, 2));
  if (!Number.isFinite(h) || h < 6) return "night";
  if (h < 12) return "morning";
  if (h < 18) return "day";
  return "evening";
}

export function transfersOf(trip: Trip): number {
  if (typeof trip.transfers === "number") return trip.transfers;
  return trip.transferCity ? 1 : 0;
}

/** Values that actually occur in the results — a filter with one option is hidden. */
export type Facets = {
  dep: Period[];
  arr: Period[];
  price: { min: number; max: number } | null;
  hours: { min: number; max: number } | null;
  stops: ("direct" | "transfer")[];
  categories: string[];
  carriers: string[];
  features: BusFeature[];
  luggage: number[];
};

const uniq = <T,>(list: T[]) => [...new Set(list)];

export function facets(trips: Trip[]): Facets {
  if (!trips.length) {
    return { dep: [], arr: [], price: null, hours: null, stops: [], categories: [], carriers: [], features: [], luggage: [] };
  }
  const prices = trips.map((t) => t.price);
  const hours = trips.map((t) => Math.ceil(t.durationMinutes / 60));
  return {
    dep: PERIODS.filter((p) => trips.some((t) => periodOf(t.departure) === p)),
    arr: PERIODS.filter((p) => trips.some((t) => periodOf(t.arrival) === p)),
    price: { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) },
    hours: { min: Math.min(...hours), max: Math.max(...hours) },
    stops: (["direct", "transfer"] as const).filter((s) =>
      trips.some((t) => (transfersOf(t) === 0) === (s === "direct"))
    ),
    categories: uniq(trips.map((t) => t.busCategory).filter((c): c is NonNullable<typeof c> => Boolean(c))),
    carriers: uniq(trips.map((t) => t.carrier)).sort((a, b) => a.localeCompare(b)),
    features: BUS_FEATURES.filter((f) => trips.some((t) => t.features?.includes(f))),
    luggage: uniq(trips.map((t) => t.luggagePieces).filter((n): n is number => typeof n === "number" && n > 0)).sort(),
  };
}

export function applyFilters(trips: Trip[], f: Filters): Trip[] {
  return trips.filter((t) => {
    if (f.dep.length && !f.dep.includes(periodOf(t.departure))) return false;
    if (f.arr.length && !f.arr.includes(periodOf(t.arrival))) return false;
    if (f.maxPrice != null && t.price > f.maxPrice) return false;
    if (f.maxHours != null && t.durationMinutes > f.maxHours * 60) return false;
    if (f.stops.length) {
      const kind = transfersOf(t) === 0 ? "direct" : "transfer";
      if (!f.stops.includes(kind)) return false;
    }
    if (f.categories.length && !(t.busCategory && f.categories.includes(t.busCategory))) return false;
    if (f.carriers.length && !f.carriers.includes(t.carrier)) return false;
    if (f.features.length && !f.features.every((x) => t.features?.includes(x))) return false;
    if (f.minLuggage != null && (t.luggagePieces ?? 0) < f.minLuggage) return false;
    return true;
  });
}

function departureKey(t: Trip): string {
  return t.departureAt ?? t.departure;
}

export function sortTrips(trips: Trip[], key: SortKey): Trip[] {
  const list = [...trips];
  const byDeparture = (a: Trip, b: Trip) => departureKey(a).localeCompare(departureKey(b));
  switch (key) {
    case "price":
      return list.sort((a, b) => a.price - b.price || byDeparture(a, b));
    case "fastest":
      return list.sort((a, b) => a.durationMinutes - b.durationMinutes || byDeparture(a, b));
    case "seats":
      return list.sort((a, b) => b.seatsLeft - a.seatsLeft || byDeparture(a, b));
    default:
      return list.sort(byDeparture);
  }
}

export function activeFilterCount(f: Filters): number {
  return (
    f.dep.length +
    f.arr.length +
    (f.maxPrice != null ? 1 : 0) +
    (f.maxHours != null ? 1 : 0) +
    f.stops.length +
    f.categories.length +
    f.carriers.length +
    f.features.length +
    (f.minLuggage != null ? 1 : 0)
  );
}

// --- URL (so a filtered list can be shared / survives reload) -------------

const LIST_KEYS = {
  dep: "fdep",
  arr: "farr",
  stops: "fstops",
  categories: "fbus",
  carriers: "fcarrier",
  features: "ffeat",
} as const;

export function filtersFromParams(params: Record<string, string | undefined>): { filters: Filters; sort: SortKey } {
  const list = (k: string) => (params[k] ? params[k]!.split(",").filter(Boolean) : []);
  const num = (k: string) => {
    const n = Number(params[k]);
    return params[k] && Number.isFinite(n) && n > 0 ? n : null;
  };
  const sort = (SORTS as readonly string[]).includes(params.sort ?? "") ? (params.sort as SortKey) : "earliest";
  return {
    sort,
    filters: {
      dep: list(LIST_KEYS.dep).filter((p): p is Period => (PERIODS as readonly string[]).includes(p)),
      arr: list(LIST_KEYS.arr).filter((p): p is Period => (PERIODS as readonly string[]).includes(p)),
      maxPrice: num("fprice"),
      maxHours: num("fhours"),
      stops: list(LIST_KEYS.stops).filter((s): s is "direct" | "transfer" => s === "direct" || s === "transfer"),
      categories: list(LIST_KEYS.categories),
      carriers: list(LIST_KEYS.carriers),
      features: list(LIST_KEYS.features).filter((x): x is BusFeature => (BUS_FEATURES as readonly string[]).includes(x)),
      minLuggage: num("flug"),
    },
  };
}

export function writeFiltersToParams(params: URLSearchParams, f: Filters, sort: SortKey): URLSearchParams {
  const out = new URLSearchParams(params);
  for (const [field, key] of Object.entries(LIST_KEYS)) {
    const values = f[field as keyof typeof LIST_KEYS] as string[];
    if (values.length) out.set(key, values.join(","));
    else out.delete(key);
  }
  const setNum = (key: string, v: number | null) => (v != null ? out.set(key, String(v)) : out.delete(key));
  setNum("fprice", f.maxPrice);
  setNum("fhours", f.maxHours);
  setNum("flug", f.minLuggage);
  if (sort !== "earliest") out.set("sort", sort);
  else out.delete("sort");
  return out;
}
