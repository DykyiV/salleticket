import { TicketStatus, type Prisma, type PrismaClient } from "@prisma/client";
import {
  buildLayout,
  defaultCoachLayoutJSON,
  isValidSeatNumber,
  parseCoachLayout,
  type BusLayout,
} from "@/lib/seats";
import {
  FULL_ROUTE,
  segmentsOverlap,
  type Segment,
} from "@/lib/trips/segments";
import { soldOnAssignment } from "@/lib/ops/legs";

export class SeatTakenError extends Error {
  constructor(seat: number) {
    super(`Місце ${seat} уже зайняте`);
    this.name = "SeatTakenError";
  }
}

export class SeatHeldError extends Error {
  constructor(seat: number) {
    super(`Місце ${seat} тимчасово заброньоване іншим пасажиром`);
    this.name = "SeatHeldError";
  }
}

export class SeatRequiredError extends Error {
  constructor() {
    super("Оберіть місце в салоні");
    this.name = "SeatRequiredError";
  }
}

const ACTIVE: TicketStatus[] = [
  TicketStatus.RESERVED,
  TicketStatus.AWAITING_PAYMENT,
  TicketStatus.PAID_ONLINE,
  TicketStatus.PAID_CASH,
];

type Db = PrismaClient | Prisma.TransactionClient;

export async function tripAssignsSeats(
  db: Db,
  tripId: string
): Promise<boolean> {
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: { departure: { select: { hasAssignedSeats: true } } },
  });
  if (!trip) return true;
  if (!trip.departure) return true;
  return trip.departure.hasAssignedSeats;
}

async function tripIdsOnSameCoach(db: Db, tripId: string): Promise<string[]> {
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      fromCity: true,
      departureId: true,
      departure: {
        select: {
          template: { select: { destinationCity: true } },
        },
      },
    },
  });
  if (!trip) return [tripId];
  if (!trip.departureId || !trip.departure?.template) return [trip.id];
  const destination = trip.departure.template.destinationCity;
  const siblings = await db.trip.findMany({
    where: { departureId: trip.departureId },
    select: { id: true, fromCity: true },
  });
  const isReturn = trip.fromCity === destination;
  return siblings
    .filter((t) =>
      isReturn ? t.fromCity === destination : t.fromCity !== destination
    )
    .map((t) => t.id);
}

function ticketSegment(t: {
  fromStopIndex: number | null;
  toStopIndex: number | null;
}): Segment {
  return {
    fromIndex: t.fromStopIndex ?? FULL_ROUTE.fromIndex,
    toIndex: t.toStopIndex ?? FULL_ROUTE.toIndex,
  };
}

/** Seats occupied on the requested segment (default: whole route). */
export async function occupiedSeatNumbers(
  db: Db,
  tripId: string,
  exceptTicketId?: string,
  segment: Segment = FULL_ROUTE
): Promise<Set<number>> {
  const ids = await tripIdsOnSameCoach(db, tripId);
  const tickets = await db.ticket.findMany({
    where: {
      status: { in: ACTIVE },
      ...(exceptTicketId ? { id: { not: exceptTicketId } } : {}),
      OR: [
        { tripId: { in: ids }, seatNumber: { not: null } },
        { returnTripId: { in: ids }, returnSeatNumber: { not: null } },
      ],
    },
    select: {
      tripId: true,
      seatNumber: true,
      returnTripId: true,
      returnSeatNumber: true,
      fromStopIndex: true,
      toStopIndex: true,
    },
  });
  const taken = new Set<number>();
  for (const t of tickets) {
    if (!segmentsOverlap(ticketSegment(t), segment)) continue;
    if (t.tripId && ids.includes(t.tripId) && t.seatNumber != null) {
      taken.add(t.seatNumber);
    }
    if (t.returnTripId && ids.includes(t.returnTripId) && t.returnSeatNumber != null) {
      taken.add(t.returnSeatNumber);
    }
  }
  return taken;
}

/** Seats locked by in-progress booking sessions on this segment. */
export async function heldSeatNumbers(
  db: Db,
  tripId: string,
  exceptSessionId?: string,
  segment: Segment = FULL_ROUTE
): Promise<Set<number>> {
  const ids = await tripIdsOnSameCoach(db, tripId);
  const holds = await db.seatHold.findMany({
    where: {
      tripId: { in: ids },
      expiresAt: { gt: new Date() },
      ...(exceptSessionId ? { sessionId: { not: exceptSessionId } } : {}),
    },
    select: { seatNumber: true, fromStopIndex: true, toStopIndex: true },
  });
  const held = new Set<number>();
  for (const h of holds) {
    if (segmentsOverlap(ticketSegment(h), segment)) held.add(h.seatNumber);
  }
  return held;
}

/** Coach layout: assigned bus on the leg/assignment, else departure bus. */
export async function coachLayoutForTrip(
  db: Db,
  tripId: string,
  assignmentId?: string
) {
  if (assignmentId) {
    const assignment = await db.vehicleAssignment.findUnique({
      where: { id: assignmentId },
      select: { bus: { select: { layout: true } } },
    });
    if (assignment) return parseCoachLayout(assignment.bus.layout);
  }
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: {
      departure: { select: { bus: { select: { layout: true } } } },
      leg: {
        select: {
          assignments: {
            where: { active: true },
            select: { bus: { select: { layout: true } } },
            orderBy: { createdAt: "asc" },
            take: 1,
          },
        },
      },
    },
  });
  const legLayout = trip?.leg?.assignments[0]?.bus.layout;
  const raw = legLayout ?? trip?.departure?.bus?.layout;
  return raw ? parseCoachLayout(raw) : defaultCoachLayoutJSON();
}

export async function getTripSeatLayout(
  db: Db,
  tripId: string,
  exceptTicketId?: string,
  sessionId?: string,
  segment: Segment = FULL_ROUTE,
  assignmentId?: string
): Promise<BusLayout> {
  const assigns = await tripAssignsSeats(db, tripId);
  if (!assigns) {
    return { decks: [], hasAssignedSeats: false, seatCount: 0, seats: [] };
  }
  const [taken, held, coach] = await Promise.all([
    assignmentId
      ? soldOnAssignment(db, assignmentId, segment)
      : occupiedSeatNumbers(db, tripId, exceptTicketId, segment),
    heldSeatNumbers(db, tripId, sessionId, segment),
    coachLayoutForTrip(db, tripId, assignmentId),
  ]);
  return buildLayout(coach, taken, held);
}

export async function seatCapacity(db: Db, tripId: string): Promise<number> {
  const coach = await coachLayoutForTrip(db, tripId);
  return buildLayout(coach).seatCount;
}

export async function assertSeatAvailable(
  db: Db,
  tripId: string,
  seatNumber: number | null | undefined,
  exceptTicketId?: string,
  sessionId?: string,
  segment: Segment = FULL_ROUTE,
  assignmentId?: string
): Promise<number | null> {
  const assigns = await tripAssignsSeats(db, tripId);
  if (!assigns) return null;
  const coach = await coachLayoutForTrip(db, tripId, assignmentId);
  const layout = buildLayout(coach);
  if (seatNumber == null || !isValidSeatNumber(seatNumber, layout)) {
    throw new SeatRequiredError();
  }
  const [taken, held] = await Promise.all([
    assignmentId
      ? soldOnAssignment(db, assignmentId, segment)
      : occupiedSeatNumbers(db, tripId, exceptTicketId, segment),
    heldSeatNumbers(db, tripId, sessionId, segment),
  ]);
  if (taken.has(seatNumber)) throw new SeatTakenError(seatNumber);
  if (held.has(seatNumber)) throw new SeatHeldError(seatNumber);
  return seatNumber;
}

/** Price multiplier of a seat within its coach layout (1 = base fare). */
export async function seatPriceMultiplier(
  db: Db,
  tripId: string,
  seatNumber: number | null
): Promise<number> {
  if (seatNumber == null) return 1;
  const coach = await coachLayoutForTrip(db, tripId);
  const seat = buildLayout(coach).seats.find((s) => s.number === seatNumber);
  return seat?.mult ?? 1;
}

/** Remove a session's holds once the booking is persisted. */
export async function releaseSessionHolds(
  db: Db,
  sessionId: string,
  tripIds: string[]
): Promise<void> {
  if (!tripIds.length) return;
  await db.seatHold.deleteMany({
    where: { sessionId, tripId: { in: tripIds } },
  });
}
