/**
 * Виїзди: departures of every carrier we sell, in one list. Each integration
 * is a source keyed by the prefix of its departure ids ("gt-31189"); today
 * that is Grandes Tour. Another integration adds its source to SOURCES and
 * stores its run id on our trips (Trip.carrierTripKey, "<prefix>-<id>-…") so
 * our passengers show on its departures.
 */

import type { TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ticketListWhere } from "@/lib/auth/access";
import { grandesTourEnabled } from "@/lib/carriers/grandes-tour/client";
import {
  gtBuses,
  gtListRoutes,
  gtListTrips,
  gtTripSeats,
  type GtDepartureItem,
  type GtSeatCounts,
} from "@/lib/carriers/grandes-tour/admin";

type Who = Parameters<typeof ticketListWhere>[0];

export type SeatCounts = GtSeatCounts;

export type BoardDeparture = {
  /** "<source>-<carrier's id>", e.g. "gt-31189". */
  id: string;
  carrier: string;
  /** "Севілія — Вінниця" (in the direction of travel). */
  route: string;
  /** Filter key and label of the route both directions share. */
  routeKey: string;
  routeName: string;
  /** ISO country of the route abroad (flag), "" when unknown. */
  countryCode: string;
  direction: "to" | "back" | null;
  from: string;
  to: string;
  date: string; // YYYY-MM-DD, first stop
  time: string; // HH:MM
  arrivalDate: string;
  arrivalTime: string;
  bus: { number: string; mark: string; seats: number; thumb: string | null };
  /** Where the board loads the seat counts from. */
  seatsUrl: string | null;
  /** Our tickets on this departure the viewer may see. */
  ours: number;
};

export type DepartureStop = { city: string; date: string; time: string; place?: string };

export type SeatPlace = {
  id: number;
  label: string;
  /** seat | wc | driver | other (aisle, table…) */
  kind: "seat" | "wc" | "driver" | "other";
  status: "free" | "reserved" | "purchased" | "closed";
  floor: number;
  x: number;
  y: number;
};

export type DepartureBus = {
  number: string;
  mark: string;
  seats: number;
  floors: number;
  photo: string | null;
  amenities: string[];
};

export type DeparturePassenger = {
  ticketId: string;
  reference: string;
  name: string;
  phone: string;
  seat: number | null;
  from: string;
  to: string;
  departure: Date;
  status: TicketStatus;
  price: number;
  leg: "outbound" | "return";
};

export type DepartureDetail = BoardDeparture & {
  phones: string | null;
  stops: DepartureStop[];
  busInfo: DepartureBus | null;
  seats: { places: SeatPlace[]; counts: SeatCounts } | null;
  passengers: DeparturePassenger[];
};

const ACTIVE: TicketStatus[] = ["RESERVED", "AWAITING_PAYMENT", "PAID_ONLINE", "PAID_CASH"];

// ─────────────────────────── Grandes Tour ───────────────────────────

/** "Вінниця - Севілія - Вінниця" → "Вінниця — Севілія" there, "Севілія — Вінниця" back. */
export function routeTitle(name: string | undefined, direction: string | undefined, from: string, to: string): string {
  const parts = (name ?? "").split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3 && parts[0] === parts[parts.length - 1] && (direction === "to" || direction === "back")) {
    const there = parts.slice(0, -1);
    return (direction === "to" ? there : [...there].reverse()).join(" — ");
  }
  return `${from} — ${to}`;
}

async function gtBoard(from: string, to: string): Promise<{ trips: GtDepartureItem[]; rows: Omit<BoardDeparture, "ours">[] }> {
  const [trips, routes, buses] = await Promise.all([gtListTrips(from, to), gtListRoutes(), gtBuses()]);
  const routeById = new Map(routes.map((r) => [r.id, r]));
  const rows = trips.map((t): Omit<BoardDeparture, "ours"> => {
    const route = t.routeId != null ? routeById.get(t.routeId) : undefined;
    const bus = t.busId != null ? buses.get(t.busId) : undefined;
    return {
      id: `gt-${t.id}`,
      carrier: t.carrierName || "Grandes Tour",
      route: routeTitle(route?.name, t.direction, t.from, t.to),
      routeKey: route ? `gt-${route.id}` : `gt-${t.from}-${t.to}`,
      routeName: route?.name.replace(/\s+-\s+/g, " — ") ?? `${t.from} — ${t.to}`,
      countryCode: route?.countryIso?.toUpperCase() ?? "",
      direction: t.direction === "to" || t.direction === "back" ? t.direction : null,
      from: t.from,
      to: t.to,
      date: t.departureDate,
      time: t.departureTime,
      arrivalDate: t.arrivalDate,
      arrivalTime: t.arrivalTime,
      bus: { number: t.busNumber, mark: bus?.mark ?? "", seats: bus?.seats ?? 0, thumb: bus?.thumb ?? null },
      seatsUrl:
        t.cityFromId && t.cityToId ? `/api/agent/departures/gt-${t.id}/seats?from=${t.cityFromId}&to=${t.cityToId}` : null,
    };
  });
  return { trips, rows };
}

const SEAT_KIND = (type: string): SeatPlace["kind"] =>
  type.startsWith("seat") ? "seat" : type === "toilet" ? "wc" : type.startsWith("driver") ? "driver" : "other";
const SEAT_STATUS = (status: string): SeatPlace["status"] =>
  status === "free" ? "free" : status === "purchased" ? "purchased" : status === "reserved" || status === "inProgress" ? "reserved" : "closed";

// ─────────────────────────── Board ───────────────────────────

const enabledSources = () => (grandesTourEnabled() ? ["gt"] : []);

/** Our tickets per departure id ("gt-31189" → 3) among those the viewer may see. */
async function ourCounts(who: Who, from: string, to: string): Promise<Map<string, number>> {
  const start = new Date(`${from}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 3);
  const end = new Date(`${to}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 4);
  const onCarrier = { carrierTripKey: { not: null }, departureTime: { gte: start, lt: end } };
  const tickets = await prisma.ticket.findMany({
    where: {
      AND: [
        await ticketListWhere(who),
        { status: { in: ACTIVE } },
        { OR: [{ trip: onCarrier }, { returnTrip: onCarrier }] },
      ],
    },
    select: { trip: { select: { carrierTripKey: true } }, returnTrip: { select: { carrierTripKey: true } } },
  });
  const counts = new Map<string, number>();
  for (const t of tickets) {
    for (const key of [t.trip?.carrierTripKey, t.returnTrip?.carrierTripKey]) {
      const id = /^([a-z]+-\d+)-/.exec(key ?? "")?.[1];
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

/** Departures between two days (YYYY-MM-DD, both included), earliest first. */
export async function listBoardDepartures(who: Who, from: string, to: string): Promise<BoardDeparture[]> {
  const sources = enabledSources();
  const [gt, counts] = await Promise.all([
    sources.includes("gt") ? gtBoard(from, to) : Promise.resolve({ rows: [] as Omit<BoardDeparture, "ours">[] }),
    ourCounts(who, from, to),
  ]);
  return gt.rows
    .map((d) => ({ ...d, ours: counts.get(d.id) ?? 0 }))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

/** Seat counts of a departure for the board's bar (null = unknown). */
export async function departureSeatCounts(id: string, fromCityId: number, toCityId: number): Promise<SeatCounts | null> {
  const m = /^gt-(\d+)$/.exec(id);
  if (!m || !enabledSources().includes("gt") || !fromCityId || !toCityId) return null;
  return (await gtTripSeats(Number(m[1]), fromCityId, toCityId))?.counts ?? null;
}

/** Our passengers on a departure (either direction of their ticket) the viewer may see, by boarding time and seat. */
async function ourPassengers(who: Who, id: string): Promise<DeparturePassenger[]> {
  const onIt = { carrierTripKey: { startsWith: `${id}-` } };
  const tickets = await prisma.ticket.findMany({
    where: {
      AND: [await ticketListWhere(who), { status: { in: ACTIVE } }, { OR: [{ trip: onIt }, { returnTrip: onIt }] }],
    },
    include: { trip: true, returnTrip: true, booking: true },
  });
  const rows: DeparturePassenger[] = [];
  for (const t of tickets) {
    for (const leg of ["outbound", "return"] as const) {
      const trip = leg === "outbound" ? t.trip : t.returnTrip;
      if (!trip?.carrierTripKey?.startsWith(`${id}-`) || !t.booking) continue;
      rows.push({
        ticketId: t.id,
        reference: t.booking.reference,
        name: `${t.booking.firstName} ${t.booking.lastName}`.trim(),
        phone: t.booking.phone,
        seat: leg === "outbound" ? t.seatNumber : t.returnSeatNumber,
        from: trip.fromCity,
        to: trip.toCity,
        departure: trip.departureTime,
        status: t.status,
        price: t.finalPrice,
        leg,
      });
    }
  }
  return rows.sort((a, b) => a.departure.getTime() - b.departure.getTime() || (a.seat ?? 0) - (b.seat ?? 0));
}

/**
 * One departure with its stops, bus (photo, comfort), seat plan and our
 * passengers. `date` (its day) finds it faster; without it the next month is
 * searched. Null when the carrier no longer lists it.
 */
export async function findDeparture(who: Who, id: string, date?: string): Promise<DepartureDetail | null> {
  const m = /^gt-(\d+)$/.exec(id);
  if (!m || !enabledSources().includes("gt")) return null;
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + 31 * 86_400_000).toISOString().slice(0, 10);
  const { trips, rows } = await gtBoard(day ?? today, day ?? until);
  const index = trips.findIndex((t) => t.id === Number(m[1]));
  if (index < 0) return null;
  const trip = trips[index];

  const [seats, buses, passengers] = await Promise.all([
    trip.cityFromId && trip.cityToId ? gtTripSeats(trip.id, trip.cityFromId, trip.cityToId) : Promise.resolve(null),
    gtBuses(),
    ourPassengers(who, id),
  ]);
  const bus = trip.busId != null ? buses.get(trip.busId) : undefined;
  return {
    ...rows[index],
    ours: passengers.length,
    phones: trip.phones ?? null,
    stops: (trip.stops ?? []).map((s) => ({ city: s.city, date: s.date, time: s.time, place: s.place })),
    busInfo: bus
      ? { number: bus.number || trip.busNumber, mark: bus.mark, seats: bus.seats, floors: bus.floors, photo: bus.photo, amenities: bus.amenities }
      : null,
    seats: seats
      ? {
          counts: seats.counts,
          places: seats.places.map((p) => ({
            id: p.id,
            label: p.name,
            kind: SEAT_KIND(p.type),
            status: SEAT_STATUS(p.status),
            floor: p.floor ?? 1,
            x: p.x ?? 0,
            y: p.y ?? 0,
          })),
        }
      : null,
    passengers,
  };
}

// ─────────────────────────── Transfers ───────────────────────────

export type TransferBus = { id: string; route: string; time: string; bus: string; busy: number };

export type TransferCity = {
  city: string;
  /** Earliest stop here among the buses ("YYYY-MM-DD HH:MM"). */
  at: string;
  /** Passengers getting on / off here, per bus (same order as `buses`), and in all. */
  perBus: { board: number; alight: number }[];
  board: number;
  alight: number;
  /** Our passengers getting on / off here. */
  ours: { name: string; reference: string; seat: number | null; bus: number; kind: "board" | "alight" }[];
};

export type TransferSummary =
  | { ok: true; date: string; countryCode: string; buses: TransferBus[]; cities: TransferCity[] }
  | { ok: false; error: string };

const BUSY = new Set(["reserved", "purchased", "inProgress"]);
const cityKey = (c: string) => c.trim().toLowerCase();

/**
 * Passengers by city for organising transfers: departures of one day and one
 * country, how many get on and off in every city from every bus (GT gives
 * each seat's booked stops, without names), with our own passengers by name.
 */
export async function transferSummary(who: Who, date: string, ids: string[]): Promise<TransferSummary> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Не вказано день." };
  const wanted = [...new Set(ids)].filter((id) => /^gt-\d+$/.test(id)).slice(0, 30);
  if (!wanted.length || !enabledSources().includes("gt")) return { ok: false, error: "Оберіть виїзди." };
  const { trips, rows } = await gtBoard(date, date);
  const chosen = wanted.map((id) => rows.findIndex((r) => r.id === id));
  if (chosen.some((i) => i < 0 || rows[i].date !== date)) {
    return { ok: false, error: "Не всі обрані виїзди знайдено на цей день — оновіть список." };
  }
  const countries = new Set(chosen.map((i) => rows[i].countryCode));
  if (countries.size > 1) return { ok: false, error: "Оберіть виїзди однієї країни." };

  const loaded = await Promise.all(
    chosen.map(async (i) => {
      const trip = trips[i];
      const [seats, passengers] = await Promise.all([
        trip.cityFromId && trip.cityToId ? gtTripSeats(trip.id, trip.cityFromId, trip.cityToId) : Promise.resolve(null),
        ourPassengers(who, rows[i].id),
      ]);
      return { row: rows[i], trip, seats, passengers };
    }),
  );

  const cities = new Map<string, TransferCity>();
  const cityAt = (name: string, at: string) => {
    const key = cityKey(name);
    let c = cities.get(key);
    if (!c) {
      c = { city: name, at, perBus: loaded.map(() => ({ board: 0, alight: 0 })), board: 0, alight: 0, ours: [] };
      cities.set(key, c);
    }
    if (at && (!c.at || at < c.at)) c.at = at;
    return c;
  };

  const buses: TransferBus[] = loaded.map(({ row, trip, seats, passengers }, b) => {
    const byIndex = new Map((trip.stops ?? []).map((s) => [s.index, s]));
    let busy = 0;
    for (const place of seats?.places ?? []) {
      if (!place.type.startsWith("seat") || !BUSY.has(place.status)) continue;
      busy++;
      for (const seg of place.segments ?? []) {
        for (const [index, kind] of [
          [seg.from, "board"],
          [seg.to, "alight"],
        ] as const) {
          const stop = byIndex.get(index);
          if (!stop) continue;
          const c = cityAt(stop.city, `${stop.date} ${stop.time}`);
          c.perBus[b][kind]++;
          c[kind]++;
        }
      }
    }
    for (const p of passengers) {
      for (const [name, kind] of [
        [p.from, "board"],
        [p.to, "alight"],
      ] as const) {
        const stop = (trip.stops ?? []).find((s) => cityKey(s.city) === cityKey(name));
        cityAt(name, stop ? `${stop.date} ${stop.time}` : "").ours.push({
          name: p.name,
          reference: p.reference,
          seat: p.seat,
          bus: b,
          kind,
        });
      }
    }
    return {
      id: row.id,
      route: row.route,
      time: row.time,
      bus: `${row.bus.mark ? `${row.bus.mark} ` : ""}${row.bus.number ? `[${row.bus.number}]` : ""}`.trim() || "—",
      busy,
    };
  });

  return {
    ok: true,
    date,
    countryCode: rows[chosen[0]].countryCode,
    buses,
    cities: [...cities.values()].sort((a, b) => (a.at || "9").localeCompare(b.at || "9")),
  };
}
