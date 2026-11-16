import type { Trip } from "@/lib/mockTrips";
import type { BusLayout, DeckView, LayoutCell, Seat } from "@/lib/seats";
import { cityNames } from "@/lib/trips/cities";
import { toE164 } from "@/lib/phone";
import { zoneFromCountries, type BaggageZone } from "@/lib/trips/baggage";
import type { BookResult, BookingRequest, CarrierAdapter, SearchQuery } from "@/lib/carriers/types";
import {
  gtCancelTicket,
  gtCheckCard,
  gtFare,
  gtKindForBirthDate,
  gtKindOfType,
  gtPassengerTypes,
  gtTicketIdFromRef,
  gtTicketRef,
  gtTypeFor,
} from "@/lib/carriers/grandes-tour/pricing";
import { gtCall } from "@/lib/carriers/grandes-tour/client";

/**
 * Grandes Tour carrier: trips, free seats and bookings come from the
 * Grandes Tour API, so seats sold here are taken in their system too.
 * Seats are assigned automatically from the free places of the bus map;
 * fares (age types, discount cards) are priced by Grandes Tour.
 */

type GtCity = { id: number; name: string; country_iso?: string | null };
type GtTrip = {
  id: number;
  bus_id?: number;
  /** Trip's order number in the GT route (reserve_tickets needs it). */
  number?: number;
  bus_number: string;
  departure_city_id: number;
  departure_city: string;
  departure_place: string;
  departure_place_latitude?: number;
  departure_place_longitude?: number;
  departure_date: string; // dd.mm.yyyy
  departure_time_hhmm: string;
  arrival_city_id: number;
  arrival_city: string;
  arrival_place: string;
  arrival_place_latitude?: number;
  arrival_place_longitude?: number;
  arrival_date: string;
  arrival_time_hhmm: string;
  price: number;
  duration: string; // d.hh:mm:ss or hh:mm:ss
  carrier_name: string;
  /** Bus / office phones, e.g. "+380… (автобус), +49… (офіс)". */
  phoneNumber?: string;
};
type GtSequence = { canBook: boolean; canBookWithPaymentAtBoarding: boolean; currency_code: string; trips: GtTrip[] };
type GtPlace = { id: number; name: string; type: string; status: string; x?: number; y?: number; floor?: number };

const CITY_TTL_MS = 60 * 60 * 1000;
let cityCache: { at: number; cities: GtCity[] } | null = null;

async function cities(): Promise<GtCity[]> {
  if (cityCache && Date.now() - cityCache.at < CITY_TTL_MS) return cityCache.cities;
  const res = await gtCall<{ cities: GtCity[] }>("/api/v3/cache/cities");
  cityCache = { at: Date.now(), cities: res.cities };
  return res.cities;
}

async function cityId(name: string): Promise<number | null> {
  const spellings = cityNames(name).map((n) => n.toLowerCase());
  const hit = (await cities()).find((c) => spellings.includes(c.name.trim().toLowerCase()));
  return hit?.id ?? null;
}

/** Direction of a trip for the baggage rules, from the cities' countries. */
export async function gtBaggageZone(from: string, to: string): Promise<BaggageZone | null> {
  try {
    const list = await cities();
    const iso = (name: string) => {
      const spellings = cityNames(name).map((n) => n.toLowerCase());
      return list.find((c) => spellings.includes(c.name.trim().toLowerCase()))?.country_iso;
    };
    return zoneFromCountries([iso(from), iso(to)]);
  } catch {
    return null;
  }
}

/** "10.11.2026" → "2026-11-10" */
function isoDate(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split(".");
  return `${y}-${m}-${d}`;
}

/** "1.23:00:00" → 2820, "23:00:00" → 1380 */
function minutes(duration: string): number {
  const [days, rest] = duration.includes(".") ? duration.split(".") : ["0", duration];
  const [h, m] = rest.split(":").map((v) => Number.parseInt(v, 10) || 0);
  return (Number.parseInt(days, 10) || 0) * 1440 + h * 60 + m;
}

/** Our trip id carries everything the API needs: gt-<tripId>-<fromCityId>-<toCityId>. */
function tripKey(trip: GtTrip): string {
  return `gt-${trip.id}-${trip.departure_city_id}-${trip.arrival_city_id}`;
}

function parseKey(id: string): { tripId: number; fromId: number; toId: number } | null {
  const m = /^gt-(\d+)-(\d+)-(\d+)$/.exec(id);
  return m ? { tripId: Number(m[1]), fromId: Number(m[2]), toId: Number(m[3]) } : null;
}

async function busMap(tripId: number, fromId: number, toId: number): Promise<GtPlace[]> {
  const res = await gtCall<{ busPlaces: GtPlace[] }>("/api/v3/booking/get_bus_map_for_trip_id", {
    query: { TripId: tripId, CityFromId: fromId, CityToId: toId },
  });
  return res.busPlaces ?? [];
}

const freeSeats = (places: GtPlace[]) => places.filter((p) => p.type === "seat" && p.status === "free");

/** Seat number shown to passengers = the place name on the GT bus map. */
const seatNo = (p: GtPlace) => Number.parseInt(p.name, 10);

/**
 * Picks the GT places for the requested seat numbers (in order); passengers
 * without a choice get the next free place.
 */
function pickPlaces(places: GtPlace[], wanted: (number | null | undefined)[]): GtPlace[] {
  const free = freeSeats(places);
  const used = new Set<number>();
  const picked: (GtPlace | null)[] = wanted.map((n) => {
    if (n == null) return null;
    const place = free.find((p) => seatNo(p) === n && !used.has(p.id));
    if (!place) throw new Error(`Місце ${n} вже зайняте — оберіть інше`);
    used.add(place.id);
    return place;
  });
  return picked.map((p) => {
    if (p) return p;
    const next = free.find((f) => !used.has(f.id));
    if (!next) throw new Error("Недостатньо вільних місць на цьому рейсі");
    used.add(next.id);
    return next;
  });
}

/**
 * Seat map of a Grandes Tour trip in our layout format: GT x = row from the
 * front, y = position across (1–2 left, 3 aisle, 4–5 right), floor = deck.
 * Seats closed for this segment ("hidden") show as unavailable.
 */
export async function gtSeatLayout(tripKeyId: string, deckNames: [string, string]): Promise<BusLayout | null> {
  const key = parseKey(tripKeyId);
  if (!key) return null;
  const places = await busMap(key.tripId, key.fromId, key.toId);
  const floors = [...new Set(places.map((p) => p.floor ?? 1))].sort((a, b) => a - b);
  const seats: Seat[] = [];
  const decks: DeckView[] = [];
  const COLS = [1, 2, 4, 5];
  floors.forEach((floor, deckIndex) => {
    const onFloor = places.filter((p) => (p.floor ?? 1) === floor);
    const xs = onFloor.filter((p) => p.type !== "none").map((p) => p.x ?? 0);
    if (!xs.length) return;
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const at = new Map(onFloor.map((p) => [`${p.x}:${p.y}`, p]));
    const rows: LayoutCell[][] = [];
    for (let x = minX; x <= maxX; x += 1) {
      rows.push(
        COLS.map((y, col) => {
          const p = at.get(`${x}:${y}`);
          if (!p || p.type === "none") return { type: "empty" } as LayoutCell;
          if (p.type === "toilet") return { type: "wc" } as LayoutCell;
          if (p.type !== "seat" || !Number.isFinite(seatNo(p))) return { type: "empty" } as LayoutCell;
          const seat: Seat = {
            number: seatNo(p),
            deck: deckIndex,
            row: x - minX + 1,
            col,
            kind: "seat",
            mult: 1,
            status: p.status === "free" ? "AVAILABLE" : p.status === "hidden" ? "HELD" : "OCCUPIED",
          };
          seats.push(seat);
          return { type: "seat", seat } as LayoutCell;
        }),
      );
    }
    decks.push({ name: floors.length > 1 ? deckNames[Math.min(deckIndex, 1)] : deckNames[0], rows });
  });
  return { hasAssignedSeats: true, decks, seatCount: seats.length, seats };
}

/** Map link of a GT stop: its coordinates when GT has them (not 0), else a search for the address. */
export function gtPlaceMap(place: string | undefined, city: string, lat?: number, lng?: number): string | undefined {
  if (lat && lng) return `https://www.google.com/maps?q=${lat},${lng}`;
  if (!place?.trim()) return undefined;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.trim()}, ${city}`)}`;
}

function toTrip(t: GtTrip, currency: string, seatsLeft: number): Trip {
  const date = isoDate(t.departure_date);
  const departureAt = `${date}T${t.departure_time_hhmm}:00.000Z`;
  const arrivalAt = `${isoDate(t.arrival_date)}T${t.arrival_time_hhmm}:00.000Z`;
  return {
    id: tripKey(t),
    carrierId: "grandes-tour",
    carrier: "Grandes Tour",
    carrierShort: "GT",
    busType: "",
    transportType: "BUS",
    from: t.departure_city,
    to: t.arrival_city,
    departure: t.departure_time_hhmm,
    arrival: t.arrival_time_hhmm,
    durationMinutes: minutes(t.duration),
    price: t.price,
    currency: currency || "EUR",
    seatsLeft,
    amenities: [],
    rating: 4.7,
    hasAssignedSeats: true,
    departureAt,
    arrivalAt,
    fromStation: t.departure_place?.trim() || undefined,
    toStation: t.arrival_place?.trim() || undefined,
    fromMap: gtPlaceMap(t.departure_place, t.departure_city, t.departure_place_latitude, t.departure_place_longitude),
    toMap: gtPlaceMap(t.arrival_place, t.arrival_city, t.arrival_place_latitude, t.arrival_place_longitude),
    carrierPhones: t.phoneNumber?.trim() || undefined,
    carrierBus: t.bus_number?.trim() || undefined,
    transfers: 0,
  };
}

/** bus_id + route order number per GT trip id (from the last search). */
const tripMeta = new Map<number, { busId?: number; number?: number }>();

/** Direct GT trips that can be booked with payment on boarding. */
async function searchSequences(
  fromId: number,
  toId: number,
  day?: string,
  passengers?: number,
  days = day ? 1 : 31,
): Promise<GtSequence[]> {
  const today = new Date().toISOString().slice(0, 10);
  const date = day && day >= today ? day : today;
  const res = await gtCall<{ trips_sequences: GtSequence[] }>("/api/v2/booking/search_trips", {
    method: "POST",
    json: {
      enable_external_search: false,
      departure_city_id: fromId,
      arrival_city_id: toId,
      depature_date: date,
      // Without a date (checkout re-check) look a month ahead to find the trip id.
      days_count_limit: days,
      passengers_count: Math.max(1, passengers ?? 1),
      currecny_code: "EUR",
      back: false,
    },
  });
  const direct = (res.trips_sequences ?? []).filter(
    (s) => s.canBook && s.canBookWithPaymentAtBoarding && s.trips?.length === 1,
  );
  for (const s of direct) tripMeta.set(s.trips[0].id, { busId: s.trips[0].bus_id, number: s.trips[0].number });
  return direct;
}

/** bus_id and route number of a GT trip (searched again if not cached). */
async function metaFor(leg: { tripId: number; fromId: number; toId: number }, day?: string) {
  if (!tripMeta.has(leg.tripId)) await searchSequences(leg.fromId, leg.toId, day).catch(() => []);
  return tripMeta.get(leg.tripId) ?? {};
}

/**
 * Lowest fare per departure day (YYYY-MM-DD → price) for 31 days from
 * `start` — for the date picker.
 */
export async function gtLowestPrices(from: string, to: string, start: string): Promise<Record<string, number>> {
  const [fromId, toId] = await Promise.all([cityId(from), cityId(to)]);
  if (!fromId || !toId) return {};
  const out: Record<string, number> = {};
  for (const s of await searchSequences(fromId, toId, start, 1, 31)) {
    const t = s.trips[0];
    const day = isoDate(t.departure_date);
    if (out[day] == null || t.price < out[day]) out[day] = t.price;
  }
  return out;
}

export class GrandesTourCarrierAdapter implements CarrierAdapter {
  readonly id = "grandes-tour";
  readonly name = "Grandes Tour";
  readonly transportType = "BUS" as const;

  async search(query: SearchQuery): Promise<Trip[]> {
    const [fromId, toId] = await Promise.all([cityId(query.from), cityId(query.to)]);
    if (!fromId || !toId) return [];
    const direct = await searchSequences(fromId, toId, query.date, query.passengers);
    return Promise.all(
      direct.map(async (s) => {
        const t = s.trips[0];
        const seats = freeSeats(await busMap(t.id, t.departure_city_id, t.arrival_city_id).catch(() => [])).length;
        return toTrip(t, s.currency_code, seats);
      }),
    );
  }

  async book(request: BookingRequest): Promise<BookResult> {
    const key = parseKey(request.tripId);
    if (!key) throw new Error("Невідомий рейс Grandes Tour");
    const back = request.returnTripId ? parseKey(request.returnTripId) : null;
    if (request.returnTripId && !back) throw new Error("Невідомий зворотний рейс Grandes Tour");
    const snapshot = request.tripSnapshot ?? {};
    const currency = snapshot.currency ?? "EUR";
    const people = request.passengers?.length ? request.passengers : [request.passenger];
    const travelDate = new Date(`${request.travelDate ?? snapshot.departureAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)}T12:00:00Z`);

    const [mapTo, mapBack] = await Promise.all([
      busMap(key.tripId, key.fromId, key.toId),
      back ? busMap(back.tripId, back.fromId, back.toId) : Promise.resolve([] as GtPlace[]),
    ]);
    const seatsTo = pickPlaces(mapTo, people.map((p) => p.seatNumber));
    const seatsBack = back ? pickPlaces(mapBack, people.map((p) => p.returnSeatNumber)) : [];

    const card = await gtCheckCard(request.discountCard);
    if (card.status === "invalid") throw new Error(`Картка ${card.number}: ${card.message}`);
    const cardNo = card.status === "ok" ? card.number : null;

    const [typesTo, typesBack] = await Promise.all([
      gtPassengerTypes(key),
      back ? gtPassengerTypes(back) : Promise.resolve([]),
    ]);
    const priced = await Promise.all(
      people.map(async (p) => {
        const chosen = p.fareTypeId != null ? typesTo.find((t) => t.id === p.fareTypeId) : undefined;
        if (p.fareTypeId != null && !chosen) throw new Error("Невідомий тип квитка");
        const kind = chosen ? gtKindOfType(chosen) : gtKindForBirthDate(p.birthDate, travelDate);
        const total = await gtFare({ to: key, back, kind, typeId: chosen?.id, card: cardNo, currency });
        return {
          kind,
          total,
          typeTo: chosen?.id ?? gtTypeFor(typesTo, kind)?.id ?? null,
          typeBack: back ? (gtTypeFor(typesBack, kind)?.id ?? null) : null,
        };
      }),
    );

    const [metaTo, metaBack] = await Promise.all([
      metaFor(key, request.travelDate),
      back ? metaFor(back, request.returnDate ?? undefined) : Promise.resolve({} as { busId?: number; number?: number }),
    ]);

    const res = await gtCall<{ order_details: { id: number; tickets?: { id: number; first_name?: string; last_name?: string; price?: number }[] } }>(
      "/api/v2/booking/reserve_tickets",
      {
        method: "POST",
        json: {
          trip_type: back ? "roundTrip" : "oneWay",
          currency_code: currency,
          // As the GT site does: pay-at-boarding bookings never auto-cancel (0);
          // online-payment bookings are held 24 h.
          hours_to_auto_cancel_reserved_status: request.paymentAtBoarding === false ? 24 : 0,
          passengers: people.map((p, i) => {
            const [first, ...rest] = p.name.trim().split(/\s+/);
            const f = priced[i];
            // Same shape as the Grandes Tour site sends (names upper case).
            return {
              first_name: (first ?? "").toUpperCase(),
              last_name: rest.join(" ").toUpperCase(),
              phone1: toE164(p.phone) ?? p.phone,
              trip_seats_to: [
                {
                  trip_id: key.tripId,
                  seat_id: seatsTo[i].id,
                  city_from_id: key.fromId,
                  city_to_id: key.toId,
                  number: metaTo.number ?? 1,
                  busId: metaTo.busId,
                  passenger_type_id: f.typeTo,
                  discount_cart: cardNo ?? "",
                },
              ],
              trip_seats_back: back
                ? [
                    {
                      trip_id: back.tripId,
                      seat_id: seatsBack[i].id,
                      city_from_id: back.fromId,
                      city_to_id: back.toId,
                      number: metaBack.number ?? 1,
                      busId: metaBack.busId,
                      passenger_type_id: f.typeBack,
                      discount_cart: cardNo ?? "",
                    },
                  ]
                : [],
            };
          }),
        },
      },
    );

    const order = res.order_details;
    const gtTickets = order.tickets ?? [];
    const tickets = people.map((p, i) => {
      const [first, ...rest] = p.name.trim().split(/\s+/);
      const byName = gtTickets.find(
        (t) =>
          (t.first_name ?? "").trim().toUpperCase() === (first ?? "").toUpperCase() &&
          (t.last_name ?? "").trim().toUpperCase() === rest.join(" ").toUpperCase(),
      );
      const t = gtTickets.length === people.length ? gtTickets[i] : byName ?? gtTickets[i];
      return {
        ref: t ? gtTicketRef(order.id, t.id) : `GT:${order.id}:`,
        price: priced[i].total.price,
        priceBeforeDiscount: priced[i].total.priceBeforeDiscount,
        kind: priced[i].kind,
      };
    });

    return {
      carrierReference: `GT-${order.id}`,
      status: "confirmed",
      tickets,
      confirmedTrip: {
        from: snapshot.from ?? "",
        to: snapshot.to ?? "",
        departure: snapshot.departure ?? "",
        arrival: snapshot.arrival ?? "",
        price: priced[0]?.total.price ?? snapshot.price ?? 0,
        currency,
      },
    };
  }

  /** Undo a reservation (used when our own booking could not be saved). */
  async cancel(refs: string[]): Promise<void> {
    await Promise.allSettled(refs.filter((r) => gtTicketIdFromRef(r)).map((r) => gtCancelTicket(r)));
  }
}

export const grandesTourCarrierAdapter = new GrandesTourCarrierAdapter();
