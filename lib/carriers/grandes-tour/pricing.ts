import { ageOn, parseBirthDate } from "@/lib/age";
import { gtCall } from "@/lib/carriers/grandes-tour/client";

/**
 * Grandes Tour fares: passenger types (age discounts) and discount cards
 * are priced by Grandes Tour itself, so the site shows and charges exactly
 * what their system records for the ticket.
 */

export type GtKind = "INFANT" | "CHILD" | "YOUTH" | "SENIOR" | "ADULT";
type GtType = { id: number; name: string; discount: number };

/** Leg of a fare: GT trip id + the sold segment. */
export type GtLeg = { tripId: number; fromId: number; toId: number };

const TYPES_TTL_MS = 10 * 60 * 1000;
const typeCache = new Map<string, { at: number; types: GtType[] }>();

/** GT passenger kind for an age on the travel date. */
export function gtKindForAge(age: number | null): GtKind {
  if (age == null || age < 0) return "ADULT";
  if (age < 4) return "INFANT"; // до 4 р. −30%
  if (age < 12) return "CHILD"; // 4–12 р. −20%
  if (age <= 24) return "YOUTH"; // молодь 12–24 −10%
  if (age >= 60) return "SENIOR"; // від 60 −10%
  return "ADULT";
}

export function gtKindForBirthDate(birthDate: string | Date | null | undefined, travelDate: Date): GtKind {
  const d = birthDate instanceof Date ? birthDate : parseBirthDate(birthDate ?? "");
  return gtKindForAge(d ? ageOn(d, travelDate) : null);
}

export type { GtType };

export function gtKindOfType(t: GtType): GtKind {
  const k = kindOfType(t);
  return k === "OTHER" ? "ADULT" : k;
}

function kindOfType(t: GtType): GtKind | "OTHER" {
  const n = (t.name ?? "").toLowerCase();
  if (/убд|бойов/.test(n)) return "OTHER";
  if (/60/.test(n)) return "SENIOR";
  if (/молод|24/.test(n)) return "YOUTH";
  if (/до\s*4/.test(n)) return "INFANT";
  if (/12/.test(n)) return "CHILD";
  if (t.discount === 0) return "ADULT";
  return "OTHER";
}

export async function gtPassengerTypes(leg: GtLeg): Promise<GtType[]> {
  const key = `${leg.tripId}-${leg.fromId}-${leg.toId}`;
  const hit = typeCache.get(key);
  if (hit && Date.now() - hit.at < TYPES_TTL_MS) return hit.types;
  const res = await gtCall<{ passenger_types: GtType[] }>("/api/v2/references/passenger_types_by_trip_id", {
    method: "POST",
    json: { trip_id: leg.tripId, city_from_id: leg.fromId, city_to_id: leg.toId },
  });
  const types = res.passenger_types ?? [];
  typeCache.set(key, { at: Date.now(), types });
  return types;
}

/** Passenger type id for a kind; falls back to the adult type. */
export function gtTypeFor(types: GtType[], kind: GtKind): GtType | null {
  return (
    types.find((t) => kindOfType(t) === kind) ??
    types.find((t) => kindOfType(t) === "ADULT") ??
    types.find((t) => t.discount === 0) ??
    types[0] ??
    null
  );
}

export type GtCardCheck =
  | { status: "none" }
  | { status: "ok"; number: string; percent: number }
  | { status: "invalid"; number: string; message: string };

/** Discount / loyalty card (or promo) known to Grandes Tour. */
export async function gtCheckCard(raw: string | null | undefined): Promise<GtCardCheck> {
  const number = (raw ?? "").trim();
  if (!number) return { status: "none" };
  try {
    const res = await gtCall<{
      discount?: { percent?: number; is_blocked?: boolean; is_within_active_period?: boolean } | null;
    }>("/api/v2/booking/get_discount_card_info", { method: "POST", json: { number } });
    const d = res.discount;
    if (!d) return { status: "invalid", number, message: "Картку не знайдено" };
    if (d.is_blocked) return { status: "invalid", number, message: "Картку заблоковано" };
    if (d.is_within_active_period === false) return { status: "invalid", number, message: "Термін дії картки минув" };
    return { status: "ok", number, percent: d.percent ?? 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message.replace(/^Grandes Tour [^:]+: /, "") : "";
    return { status: "invalid", number, message: message || "Картку не знайдено" };
  }
}

export type GtFare = { kind: GtKind; typeId: number | null; price: number; priceBeforeDiscount: number };

/**
 * One passenger's fare from Grandes Tour (both directions for a return
 * ticket). `card` must already be validated (pass null otherwise).
 */
export async function gtFare(opts: {
  to: GtLeg;
  back?: GtLeg | null;
  kind: GtKind;
  /** Explicit GT passenger type (chosen by the buyer); else by kind. */
  typeId?: number | null;
  card?: string | null;
  currency?: string;
}): Promise<GtFare> {
  const [typesTo, typesBack] = await Promise.all([
    gtPassengerTypes(opts.to),
    opts.back ? gtPassengerTypes(opts.back) : Promise.resolve([] as GtType[]),
  ]);
  const explicit = opts.typeId != null ? typesTo.find((t) => t.id === opts.typeId) : undefined;
  const typeTo = explicit ?? gtTypeFor(typesTo, opts.kind);
  // The way back has its own type ids: same kind (and same name if possible).
  const typeBack = opts.back
    ? ((explicit && typesBack.find((t) => t.name === explicit.name)) ?? gtTypeFor(typesBack, opts.kind))
    : null;
  const leg = (l: GtLeg, typeId: number | null) => ({
    trip_id: l.tripId,
    city_from_id: l.fromId,
    city_to_id: l.toId,
    passenger_type_id: typeId,
    discount_cart: opts.card || null,
    number: 1,
  });
  const res = await gtCall<{ price: number; priceBeforeDiscount: number }>("/api/v2/booking/passenger_ticket_price", {
    method: "POST",
    json: {
      trip_mode: opts.back ? "roundTrip" : "oneWay",
      currecny_code: opts.currency ?? "EUR",
      price_trips_to: [leg(opts.to, typeTo?.id ?? null)],
      price_trips_back: opts.back ? [leg(opts.back, typeBack?.id ?? null)] : [],
    },
  });
  return {
    kind: opts.kind,
    typeId: typeTo?.id ?? null,
    price: Math.round((res.price ?? 0) * 100) / 100,
    priceBeforeDiscount: Math.round((res.priceBeforeDiscount ?? res.price ?? 0) * 100) / 100,
  };
}

/** "gt-<trip>-<from>-<to>" → leg. */
export function gtLegFromKey(key: string): GtLeg | null {
  const m = /^gt-(\d+)-(\d+)-(\d+)$/.exec(key);
  return m ? { tripId: Number(m[1]), fromId: Number(m[2]), toId: Number(m[3]) } : null;
}

/** Ticket reference stored on our ticket: "GT:<order>:<ticket>". */
export function gtTicketRef(orderId: number, ticketId: number): string {
  return `GT:${orderId}:${ticketId}`;
}

export function gtTicketIdFromRef(ref: string | null | undefined): number | null {
  const m = /^GT:\d+:(\d+)$/.exec(ref ?? "");
  return m ? Number(m[1]) : null;
}

/** Cancels a reserved ticket in Grandes Tour. */
export async function gtCancelTicket(ref: string): Promise<void> {
  const ticketId = gtTicketIdFromRef(ref);
  if (!ticketId) throw new Error(`Bad Grandes Tour ticket ref: ${ref}`);
  await gtCall("/api/v2/booking/cancel_ticket", { method: "POST", json: { ticket_id: ticketId } });
}

/** "GT:<order>:<ticket>" → both ids. */
export function gtRefParts(ref: string | null | undefined): { orderId: number; ticketId: number } | null {
  const m = /^GT:(\d+):(\d+)$/.exec(ref ?? "");
  return m ? { orderId: Number(m[1]), ticketId: Number(m[2]) } : null;
}

/** Current status of each ticket of a GT order ("reserved", "canceled", …), by GT ticket id. */
export async function gtOrderTicketStatuses(orderId: number): Promise<Map<number, string>> {
  const res = await gtCall<{ tickets?: { id: number; status: string }[] }>(`/api/v4/booking/order/${orderId}/tickets`);
  return new Map((res.tickets ?? []).map((t) => [t.id, t.status]));
}

/** One direction of a GT ticket: trip key, seat number, date (YYYY-MM-DD), fare type. */
export type GtTicketLeg = { key: string; seatNumber: number; date: string; typeId: number | null };

type GtSeatRow = {
  trip_id?: number;
  city_from_id?: number;
  city_to_id?: number;
  place_name?: string;
  departure_date?: string;
  passenger_type_id?: number;
  discount_cart?: string;
};

function gtLegOf(row: GtSeatRow | undefined): GtTicketLeg | null {
  if (!row?.trip_id || !row.city_from_id || !row.city_to_id) return null;
  const [d, m, y] = (row.departure_date ?? "").split(".");
  return {
    key: `gt-${row.trip_id}-${row.city_from_id}-${row.city_to_id}`,
    seatNumber: Number(row.place_name),
    date: `${y}-${m}-${d}`,
    typeId: row.passenger_type_id ?? null,
  };
}

/** A GT ticket as GT holds it: both directions (trip, seat, date, fare type) and the card. */
export async function gtTicketDetails(
  orderId: number,
  ticketId: number,
): Promise<{ to: GtTicketLeg; back: GtTicketLeg | null; discountCard: string | null }> {
  const res = await gtCall<{
    order_details?: { tickets?: { id: number; trip_seats_to?: GtSeatRow[]; trip_seats_back?: GtSeatRow[] }[] };
  }>("/api/v2/booking/get_order_details", { method: "POST", json: { id: orderId } });
  const t = res.order_details?.tickets?.find((x) => x.id === ticketId);
  const to = gtLegOf(t?.trip_seats_to?.[0]);
  if (!t || !to) throw new Error(`Grandes Tour: квиток ${ticketId} не знайдено в замовленні ${orderId}`);
  return {
    to,
    back: gtLegOf(t.trip_seats_back?.[0]),
    discountCard: t.trip_seats_to?.[0]?.discount_cart?.trim() || null,
  };
}

/** A ticket removed on GT's side (their site or office) has the status "canceled". */
export function gtIsCancelled(status: string | null | undefined): boolean {
  return status === "canceled" || status === "cancelled";
}

export type GtFareType = { id: number; name: string; discount: number; kind: GtKind };

/** Ticket types the carrier offers on this trip (for the checkout select). */
export async function gtFareTypes(tripKeyId: string): Promise<GtFareType[]> {
  const leg = gtLegFromKey(tripKeyId);
  if (!leg) return [];
  const types = await gtPassengerTypes(leg);
  return types.map((t) => ({ id: t.id, name: t.name, discount: t.discount, kind: gtKindOfType(t) }));
}
