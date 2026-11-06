/**
 * Admin helpers for Grandes Tour data: upcoming trips, seat occupancy,
 * buses (with photos), buses by carrier, routes with their stops. Used by the
 * cabinet sections Виїзди, Перевізники and Маршрути GT. Read-only.
 *
 * GT endpoints (swagger v3): GET /api/v4/booking/trips?from&to (trips with
 * their stops; `from` must be in the future), GET
 * /api/v3/booking/get_bus_map_for_trip_id (needs the boarding / leaving city),
 * POST /api/v2/references/buses, GET /api/v3/cache/routes and
 * POST /api/v2/references/route_details.
 */

import { gtCall } from "@/lib/carriers/grandes-tour/client";

// ─────────────────────────── Types ───────────────────────────

/** A visible stop of a GT trip. */
export type GtTripStop = {
  /** Position among all the trip's stops (hidden too) — what GT's seat bookings point at. */
  index: number;
  cityId?: number;
  city: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  place?: string;
};

export type GtDepartureItem = {
  id: number;
  tripNumber?: number;
  from: string;
  to: string;
  /** First and last stop of the trip (for the seat map). */
  cityFromId?: number;
  cityToId?: number;
  departureDate: string; // YYYY-MM-DD
  departureTime: string; // HH:MM
  arrivalDate: string;
  arrivalTime: string;
  carrierName: string;
  busNumber: string;
  busId?: number;
  price?: number;
  status?: string;
  /** "to" / "back" as GT gives it. */
  direction?: string;
  routeId?: number;
  /** Bus and office phones of the route. */
  phones?: string;
  stops?: GtTripStop[];
};

export type GtPlaceItem = {
  id: number;
  name: string;
  type: string;
  status: string;
  floor?: number;
  x?: number;
  y?: number;
  /** Bookings of this seat: from / to stop position (GtTripStop.index), boarding at `from`, leaving at `to`. */
  segments?: { from: number; to: number }[];
};

/** Seats of a trip by GT status: free, reserved (unpaid), purchased (paid), closed (hidden). */
export type GtSeatCounts = { total: number; free: number; reserved: number; purchased: number; closed: number };

export type GtTripSeats = { places: GtPlaceItem[]; counts: GtSeatCounts };

/** A GT bus: plate, make, seats, decks, photo and comfort. */
export type GtBus = {
  id: number;
  number: string;
  mark: string;
  seats: number;
  floors: number;
  photo: string | null;
  amenities: string[];
};

export type BusEntry = {
  busNumber: string;
  busId?: number;
  tripCount: number;
  firstSeen: string; // YYYY-MM-DD
  lastSeen: string;  // YYYY-MM-DD
};

export type CarrierGroup = {
  name: string;
  buses: BusEntry[];
};

export type GtStop = {
  cityName: string;
  place?: string;
  /** Departure time from this stop on the way there / on the way back (HH:MM). */
  outTime?: string | null;
  backTime?: string | null;
};

export type GtRoute = {
  id: number;
  name: string;
  countryIso?: string;
  scheduleDays?: string[];
  description?: string;
  stops?: GtStop[];
};

// ─────────────────────────── Raw GT shapes ───────────────────────────

type RawTripCity = {
  Number?: number;
  CityId?: number;
  CityName?: string;
  IsHidden?: boolean;
  Date?: string; // dd.mm.yyyy
  Time?: string; // HH:MM:SS
  PlaceName?: string;
};

type RawTripRoute = { RouteId?: number; PhonesDay1?: string };

/** One item of GET /api/v4/booking/trips (TripCities and Route come as JSON strings). */
export type RawGtTrip = {
  Id: number;
  IsHidden?: boolean;
  IsDeleted?: boolean;
  BusId?: number;
  BusNumber?: string;
  CarrierName?: string;
  Date?: string;
  Direction?: string;
  TripCities?: string | RawTripCity[];
  Route?: string | RawTripRoute;
};

type RawGtRoute = {
  id: number;
  name?: string;
  countryISO?: string;
  Schedule?: { departure_day?: string; return_day?: string }[];
};

type RawRouteItem = { city_name?: string; place?: string; departure_time_str?: string; return_time_str?: string };

// ─────────────────────────── Date helpers ───────────────────────────

/** "10.11.2026" → "2026-11-10", pass-through if already ISO */
function normaliseDate(raw: string | undefined): string {
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parts = raw.split(".");
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return raw;
}

/** Returns today as YYYY-MM-DD */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Returns YYYY-MM-DD offset by `days` from today */
export function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─────────────────────────── List trips ───────────────────────────

function parseJson<T>(raw: string | T | undefined): T | null {
  if (raw == null) return null;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** A GT trip as the board shows it: first and last visible stop, all visible stops, route. */
export function mapGtTrip(t: RawGtTrip): GtDepartureItem | null {
  const all = (parseJson<RawTripCity[]>(t.TripCities) ?? []).sort((a, b) => (a.Number ?? 0) - (b.Number ?? 0));
  const stops = all.filter((c) => !c.IsHidden && c.CityName);
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last || first === last) return null;
  const route = parseJson<RawTripRoute>(t.Route);
  return {
    id: t.Id,
    from: first.CityName ?? "",
    to: last.CityName ?? "",
    cityFromId: first.CityId,
    cityToId: last.CityId,
    departureDate: normaliseDate(first.Date ?? t.Date),
    departureTime: (first.Time ?? "").slice(0, 5),
    arrivalDate: normaliseDate(last.Date),
    arrivalTime: (last.Time ?? "").slice(0, 5),
    carrierName: t.CarrierName ?? "",
    busNumber: t.BusNumber ?? "",
    busId: t.BusId,
    status: t.Direction === "back" ? "назад" : t.Direction === "to" ? "туди" : undefined,
    direction: t.Direction,
    routeId: route?.RouteId,
    phones: route?.PhonesDay1?.trim() || undefined,
    stops: stops.map((c) => ({
      index: all.indexOf(c),
      cityId: c.CityId,
      city: c.CityName ?? "",
      date: normaliseDate(c.Date),
      time: (c.Time ?? "").slice(0, 5),
      place: c.PlaceName?.trim() || undefined,
    })),
  };
}

/**
 * GT trips departing between `from` and `to` (YYYY-MM-DD, both included).
 * GT only lists trips from now on, so a past `from` starts from now.
 */
const TRIPS_TTL_MS = 2 * 60 * 1000;
const tripsCache = new Map<string, { at: number; trips: GtDepartureItem[] }>();

export async function gtListTrips(from: string, to: string): Promise<GtDepartureItem[]> {
  const cached = tripsCache.get(`${from}|${to}`);
  if (cached && Date.now() - cached.at < TRIPS_TTL_MS) return cached.trips;
  const soon = new Date(Date.now() + 60_000);
  const start = new Date(`${from}T00:00:00Z`) > soon ? `${from}T00:00:00` : soon.toISOString().slice(0, 19);
  const end = new Date(`${to}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  try {
    const raw = await gtCall<RawGtTrip[]>("/api/v4/booking/trips", {
      query: { from: start, to: end.toISOString().slice(0, 10) },
    });
    const trips = (Array.isArray(raw) ? raw : [])
      .filter((t) => !t.IsHidden && !t.IsDeleted)
      .map(mapGtTrip)
      .filter((t): t is GtDepartureItem => t !== null)
      .sort((a, b) => `${a.departureDate} ${a.departureTime}`.localeCompare(`${b.departureDate} ${b.departureTime}`));
    tripsCache.set(`${from}|${to}`, { at: Date.now(), trips });
    return trips;
  } catch {
    return [];
  }
}

// ─────────────────────────── Bus map / occupancy ───────────────────────────

const isSeat = (p: { type: string }) => p.type.startsWith("seat");

/** Seat counts by GT status (any seat type: GT also has turned seats, "seat90" etc.). */
export function countSeats(places: GtPlaceItem[]): GtSeatCounts {
  const seats = places.filter(isSeat);
  const by = (...st: string[]) => seats.filter((p) => st.includes(p.status)).length;
  const free = by("free");
  const reserved = by("reserved", "inProgress");
  const purchased = by("purchased");
  return { total: seats.length, free, reserved, purchased, closed: seats.length - free - reserved - purchased };
}

const SEATS_TTL_MS = 2 * 60 * 1000;
const seatsCache = new Map<string, { at: number; seats: GtTripSeats }>();

/** Seat map of a trip between two of its stops (whole trip: first → last) with the counts; null when GT fails. */
export async function gtTripSeats(tripId: number, cityFromId: number, cityToId: number): Promise<GtTripSeats | null> {
  const key = `${tripId}|${cityFromId}|${cityToId}`;
  const cached = seatsCache.get(key);
  if (cached && Date.now() - cached.at < SEATS_TTL_MS) return cached.seats;
  try {
    const res = await gtCall<{
      busPlaces?: (GtPlaceItem & { trips?: { TripCityFromIndex?: number; TripCityToIndex?: number }[] })[];
    }>("/api/v3/booking/get_bus_map_for_trip_id", {
      query: { TripId: tripId, CityFromId: cityFromId, CityToId: cityToId },
    });
    const places: GtPlaceItem[] = (res.busPlaces ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      status: p.status,
      floor: p.floor,
      x: p.x,
      y: p.y,
      segments: (p.trips ?? [])
        .filter((s) => s.TripCityFromIndex != null && s.TripCityToIndex != null)
        .map((s) => ({ from: s.TripCityFromIndex!, to: s.TripCityToIndex! })),
    }));
    const seats = { places, counts: countSeats(places) };
    seatsCache.set(key, { at: Date.now(), seats });
    return seats;
  } catch {
    return null;
  }
}

// ─────────────────────────── Buses ───────────────────────────

type RawGtBus = {
  id: number;
  number?: string;
  mark?: string;
  places_count?: number;
  floors_count?: number;
  image_url?: string | null;
} & Record<string, unknown>;

const AMENITIES: [string, string][] = [
  ["has_air_condition", "Кондиціонер"],
  ["has_wifi", "Wi-Fi"],
  ["has_wc", "WC"],
  ["has_adjustable_seats", "Регульовані сидіння"],
  ["has_hot_drinks", "Гарячі напої"],
  ["has_drinks", "Напої"],
  ["has_microwave", "Мікрохвильовка"],
  ["has_tv", "TV"],
  ["has_places_for_persons_with_disabilities", "Місця для людей з інвалідністю"],
  ["has_seat_belts", "Ремені безпеки"],
];

export function mapGtBus(b: RawGtBus): GtBus {
  return {
    id: b.id,
    number: b.number?.trim() ?? "",
    mark: b.mark?.trim() ?? "",
    seats: b.places_count ?? 0,
    floors: b.floors_count ?? 1,
    photo: b.image_url || null,
    amenities: AMENITIES.filter(([k]) => b[k] === true).map(([, label]) => label),
  };
}

const BUSES_TTL_MS = 60 * 60 * 1000;
let busesCache: { at: number; buses: Map<number, GtBus> } | null = null;

/** GT buses by id, with their photos (cached 1 h; the photo links stay valid for a year). */
export async function gtBuses(): Promise<Map<number, GtBus>> {
  if (busesCache && Date.now() - busesCache.at < BUSES_TTL_MS) return busesCache.buses;
  try {
    const res = await gtCall<{ buses?: RawGtBus[] }>("/api/v2/references/buses", {
      method: "POST",
      json: { include_photos: true, page_number: 0, page_size: 200 },
    });
    const buses = new Map((res.buses ?? []).map((b) => [b.id, mapGtBus(b)]));
    busesCache = { at: Date.now(), buses };
    return buses;
  } catch {
    return busesCache?.buses ?? new Map();
  }
}

// ─────────────────────────── Carrier aggregation ───────────────────────────

/** Groups the buses of the trips between `from` and `to` by carrier. */
export function groupBusesByCarrier(trips: GtDepartureItem[]): CarrierGroup[] {
  const busMap = new Map<string, { busId?: number; carrier: string; dates: string[] }>();
  for (const t of trips) {
    if (!t.busNumber) continue;
    const existing = busMap.get(t.busNumber);
    if (existing) {
      existing.dates.push(t.departureDate);
    } else {
      busMap.set(t.busNumber, { busId: t.busId, carrier: t.carrierName || "—", dates: [t.departureDate] });
    }
  }

  const carrierMap = new Map<string, BusEntry[]>();
  for (const [busNumber, info] of busMap) {
    const sorted = [...info.dates].sort();
    const entry: BusEntry = {
      busNumber,
      busId: info.busId,
      tripCount: sorted.length,
      firstSeen: sorted[0] ?? "",
      lastSeen: sorted[sorted.length - 1] ?? "",
    };
    const list = carrierMap.get(info.carrier) ?? [];
    list.push(entry);
    carrierMap.set(info.carrier, list);
  }

  return [...carrierMap.entries()].map(([name, buses]) => ({ name, buses }));
}

export async function gtCarrierBuses(from: string, to: string): Promise<CarrierGroup[]> {
  return groupBusesByCarrier(await gtListTrips(from, to));
}

// ─────────────────────────── GT Routes ───────────────────────────

const ROUTES_TTL_MS = 60 * 60 * 1000;
let routesCache: { at: number; routes: GtRoute[] } | null = null;

/** GT routes with their days and stops (cached 1 h). */
export async function gtListRoutes(): Promise<GtRoute[]> {
  if (routesCache && Date.now() - routesCache.at < ROUTES_TTL_MS) return routesCache.routes;
  try {
    const res = await gtCall<{ routes?: RawGtRoute[] }>("/api/v3/cache/routes");
    const routes = await Promise.all(
      (res.routes ?? []).map(async (r): Promise<GtRoute> => {
        const details = await gtCall<{ schedules?: { items?: RawRouteItem[] }[] }>("/api/v2/references/route_details", {
          method: "POST",
          json: { id: r.id },
        }).catch(() => null);
        return {
          id: r.id,
          name: r.name ?? `Маршрут ${r.id}`,
          countryIso: r.countryISO,
          scheduleDays: (r.Schedule ?? []).map((s) => `${s.departure_day ?? "?"} / ${s.return_day ?? "?"}`),
          stops: (details?.schedules?.[0]?.items ?? []).map((i) => ({
            cityName: i.city_name ?? "",
            place: i.place,
            outTime: i.departure_time_str ?? null,
            backTime: i.return_time_str ?? null,
          })),
        };
      }),
    );
    routesCache = { at: Date.now(), routes };
    return routes;
  } catch {
    return [];
  }
}
