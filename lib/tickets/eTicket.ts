import type { Prisma, Role, TicketStatus, TripKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ticketRights } from "@/lib/auth/access";
import { mapsUrl } from "@/lib/routes/boarding";
import { combineUtcDateTime } from "@/lib/routes/dates";

/**
 * Passenger e-ticket: one model used by the ticket page, the PDF and the
 * e-mail, so all three always say the same thing. Times are wall-clock
 * "YYYY-MM-DDTHH:MM" strings — trips store local times as UTC.
 */

const BUS_SELECT = { select: { plate: true, model: true } } as const;

const TRIP_INCLUDE = {
  carrier: { select: { name: true } },
  departure: {
    select: {
      date: true,
      defaultBus: true,
      hasAssignedSeats: true,
      bus: BUS_SELECT,
      template: { select: { destinationCity: true } },
      stops: {
        orderBy: { sortOrder: "asc" },
        select: {
          city: true,
          addressLabel: true,
          boardingAddress: true,
          latitude: true,
          longitude: true,
          outboundDay: true,
          outboundTime: true,
          returnDay: true,
          returnTime: true,
          isVisible: true,
        },
      },
    },
  },
} satisfies Prisma.TripInclude;

/** Everything the e-ticket needs, in one query. */
export const ETICKET_INCLUDE = {
  ticket: {
    include: {
      trip: { include: TRIP_INCLUDE },
      returnTrip: { include: TRIP_INCLUDE },
      assignment: { include: { bus: BUS_SELECT } },
      legs: {
        orderBy: { order: "asc" },
        include: {
          trip: { select: { fromCity: true, toCity: true } },
          assignment: { include: { bus: BUS_SELECT } },
        },
      },
    },
  },
} satisfies Prisma.BookingInclude;

export type ETicketBooking = Prisma.BookingGetPayload<{ include: typeof ETICKET_INCLUDE }>;
type TripRow = NonNullable<ETicketBooking["ticket"]["trip"]>;
type BusRow = { plate: string; model: string | null } | null | undefined;

export type ETicketState = "due" | "pending" | "paid" | "cancelled" | "refunded";

export type ETicketLeg = { from: string; to: string; seat: number | null; bus: string | null };

export type ETicketJourney = {
  kind: "outbound" | "return";
  from: string;
  to: string;
  departAt: string | null;
  arriveAt: string | null;
  boardAddress: string | null;
  boardMap: string | null;
  alightAddress: string | null;
  alightMap: string | null;
  seat: number | null;
  freeSeating: boolean;
  bus: string | null;
  carrier: string | null;
  legs: ETicketLeg[];
};

export type ETicket = {
  reference: string;
  groupRef: string | null;
  status: TicketStatus;
  state: ETicketState;
  firstName: string;
  lastName: string;
  ageCategory: string;
  email: string | null;
  phone: string;
  price: number;
  toPay: number;
  issuedAt: string;
  tripKind: TripKind;
  openReturn: boolean;
  journeys: ETicketJourney[];
  checkUrl: string;
};

export function ticketState(status: TicketStatus): ETicketState {
  switch (status) {
    case "PAID_ONLINE":
    case "PAID_CASH":
      return "paid";
    case "AWAITING_PAYMENT":
      return "pending";
    case "CANCELLED":
      return "cancelled";
    case "REFUNDED":
      return "refunded";
    default:
      return "due";
  }
}

const wall = (d: Date) => d.toISOString().slice(0, 16);
const same = (a?: string | null, b?: string | null) => Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

function busLabel(bus: BusRow, fallback?: string | null): string | null {
  if (bus) return [bus.model, bus.plate].filter(Boolean).join(" ").trim() || null;
  return fallback?.trim() || null;
}

type Stop = { city: string; address: string | null; map: string | null; at: string };

/** Stops of a trip in travel order (return runs go backwards), visible first. */
function orderedStops(trip: TripRow): Stop[] {
  const dep = trip.departure;
  if (!dep) return [];
  const isReturn = same(trip.fromCity, dep.template.destinationCity);
  const rows = isReturn ? [...dep.stops].reverse() : dep.stops;
  return rows
    .filter((s) => s.isVisible)
    .map((s) => ({
      city: s.city,
      address: s.boardingAddress || s.addressLabel || null,
      map: mapsUrl(s),
      at: wall(isReturn ? combineUtcDateTime(dep.date, s.returnDay, s.returnTime) : combineUtcDateTime(dep.date, s.outboundDay, s.outboundTime)),
    }));
}

function journey(
  kind: ETicketJourney["kind"],
  trip: TripRow,
  from: string,
  to: string,
  seat: number | null,
  bus: string | null,
  legs: ETicketLeg[]
): ETicketJourney {
  const stops = orderedStops(trip);
  const bi = stops.findIndex((s) => same(s.city, from));
  const ai = stops.findIndex((s, i) => i > bi && same(s.city, to));
  const board = bi >= 0 ? stops[bi] : null;
  const alight = ai >= 0 ? stops[ai] : null;
  const dep = trip.departure;
  return {
    kind,
    from,
    to,
    departAt: board?.at ?? wall(trip.departureTime),
    arriveAt: alight?.at ?? wall(trip.arrivalTime),
    boardAddress: board?.address ?? null,
    boardMap: board?.map ?? null,
    alightAddress: alight?.address ?? null,
    alightMap: alight?.map ?? null,
    seat,
    freeSeating: dep?.hasAssignedSeats === false || seat == null,
    bus: bus ?? busLabel(dep?.bus, dep?.defaultBus),
    carrier: trip.carrier?.name ?? null,
    legs,
  };
}

export function toETicket(b: ETicketBooking, origin: string): ETicket {
  const t = b.ticket;
  const state = ticketState(t.status);
  const journeys: ETicketJourney[] = [];
  if (t.trip) {
    const from = t.fromCity ?? t.trip.fromCity;
    const to = t.toCity ?? t.trip.toCity;
    const legs: ETicketLeg[] =
      t.legs.length > 1
        ? t.legs.map((l) => ({
            from: l.fromCity ?? l.trip.fromCity,
            to: l.toCity ?? l.trip.toCity,
            seat: l.seatNumber ?? null,
            bus: busLabel(l.assignment?.bus),
          }))
        : [];
    const bus = busLabel(t.legs[0]?.assignment?.bus ?? t.assignment?.bus);
    journeys.push(journey("outbound", t.trip, from, to, t.seatNumber ?? t.legs[0]?.seatNumber ?? null, bus, legs));
  }
  if (t.returnTrip) {
    const from = t.toCity ?? t.returnTrip.fromCity;
    const to = t.fromCity ?? t.returnTrip.toCity;
    journeys.push(journey("return", t.returnTrip, from, to, t.returnSeatNumber ?? null, null, []));
  }
  return {
    reference: b.reference,
    groupRef: b.groupRef,
    status: t.status,
    state,
    firstName: b.firstName,
    lastName: b.lastName,
    ageCategory: b.ageCategory,
    email: b.email,
    phone: b.phone,
    price: t.finalPrice,
    toPay: state === "due" || state === "pending" ? t.finalPrice : 0,
    issuedAt: b.createdAt.toISOString(),
    tripKind: t.tripKind,
    openReturn: t.tripKind === "OPEN_RETURN",
    journeys,
    checkUrl: `${origin.replace(/\/$/, "")}/check/${b.reference}`,
  };
}

/** Bookings of the same order as `reference`, oldest first. */
export async function loadGroupBookings(reference: string): Promise<ETicketBooking[]> {
  const head = await prisma.booking.findUnique({ where: { reference }, select: { groupRef: true } });
  if (!head) return [];
  return prisma.booking.findMany({
    where: head.groupRef ? { groupRef: head.groupRef } : { reference },
    include: ETICKET_INCLUDE,
    orderBy: [{ createdAt: "asc" }, { reference: "asc" }],
  });
}

/**
 * The order's bookings this viewer may see, or null when the requested one
 * is not theirs (callers answer 404 — no hint the reference exists).
 */
export async function viewableGroup(
  reference: string,
  who: { sub: string; role: Role }
): Promise<ETicketBooking[] | null> {
  const all = await loadGroupBookings(reference);
  const allowed: ETicketBooking[] = [];
  for (const b of all) {
    if ((await ticketRights(who, b.ticket)).canView) allowed.push(b);
  }
  return allowed.some((b) => b.reference === reference) ? allowed : null;
}

/** Site origin for links in PDFs and e-mails: SITE_URL, else the request's. */
export function siteOrigin(fallback?: string | null): string {
  const env = process.env.SITE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  return (fallback ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Origin of an incoming request, as the visitor sees it (proxy-aware). */
export function requestOrigin(req: { headers: Headers; nextUrl: { origin: string } }): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? (req.nextUrl.origin.startsWith("https") ? "https" : "http");
  return siteOrigin(host ? `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}` : req.nextUrl.origin);
}
