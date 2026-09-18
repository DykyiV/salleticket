import { TicketStatus, type Prisma, type PrismaClient } from "@prisma/client";
import { emptySeatLayout, isValidSeatNumber, type BusLayout } from "@/lib/seats";

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

export async function occupiedSeatNumbers(
  db: Db,
  tripId: string,
  exceptTicketId?: string
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
    select: { tripId: true, seatNumber: true, returnTripId: true, returnSeatNumber: true },
  });
  const taken = new Set<number>();
  for (const t of tickets) {
    if (t.tripId && ids.includes(t.tripId) && t.seatNumber != null) {
      taken.add(t.seatNumber);
    }
    if (t.returnTripId && ids.includes(t.returnTripId) && t.returnSeatNumber != null) {
      taken.add(t.returnSeatNumber);
    }
  }
  return taken;
}

/** Seats locked by in-progress booking sessions (not yet paid tickets). */
export async function heldSeatNumbers(
  db: Db,
  tripId: string,
  exceptSessionId?: string
): Promise<Set<number>> {
  const ids = await tripIdsOnSameCoach(db, tripId);
  const holds = await db.seatHold.findMany({
    where: {
      tripId: { in: ids },
      expiresAt: { gt: new Date() },
      ...(exceptSessionId ? { sessionId: { not: exceptSessionId } } : {}),
    },
    select: { seatNumber: true },
  });
  return new Set(holds.map((h) => h.seatNumber));
}

export async function getTripSeatLayout(
  db: Db,
  tripId: string,
  exceptTicketId?: string,
  sessionId?: string
): Promise<BusLayout> {
  const assigns = await tripAssignsSeats(db, tripId);
  if (!assigns) {
    return { rows: 0, hasToilet: false, hasAssignedSeats: false, seats: [] };
  }
  const [taken, held] = await Promise.all([
    occupiedSeatNumbers(db, tripId, exceptTicketId),
    heldSeatNumbers(db, tripId, sessionId),
  ]);
  return emptySeatLayout(taken, held);
}

export async function assertSeatAvailable(
  db: Db,
  tripId: string,
  seatNumber: number | null | undefined,
  exceptTicketId?: string,
  sessionId?: string
): Promise<number | null> {
  const assigns = await tripAssignsSeats(db, tripId);
  if (!assigns) return null;
  if (seatNumber == null || !isValidSeatNumber(seatNumber)) {
    throw new SeatRequiredError();
  }
  const [taken, held] = await Promise.all([
    occupiedSeatNumbers(db, tripId, exceptTicketId),
    heldSeatNumbers(db, tripId, sessionId),
  ]);
  if (taken.has(seatNumber)) throw new SeatTakenError(seatNumber);
  if (held.has(seatNumber)) throw new SeatHeldError(seatNumber);
  return seatNumber;
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
