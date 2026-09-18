import { TicketStatus, type Prisma, type PrismaClient } from "@prisma/client";
import { emptySeatLayout, isValidSeatNumber, type BusLayout } from "@/lib/seats";

export class SeatTakenError extends Error {
  constructor(seat: number) {
    super(`Місце ${seat} уже зайняте`);
    this.name = "SeatTakenError";
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
    .filter((t) => (isReturn ? t.fromCity === destination : t.fromCity !== destination))
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

export async function getTripSeatLayout(
  db: Db,
  tripId: string,
  exceptTicketId?: string
): Promise<BusLayout> {
  const assigns = await tripAssignsSeats(db, tripId);
  if (!assigns) {
    return { rows: 0, hasToilet: false, hasAssignedSeats: false, seats: [] };
  }
  const taken = await occupiedSeatNumbers(db, tripId, exceptTicketId);
  return emptySeatLayout(taken);
}

export async function assertSeatAvailable(
  db: Db,
  tripId: string,
  seatNumber: number | null | undefined,
  exceptTicketId?: string
): Promise<number | null> {
  const assigns = await tripAssignsSeats(db, tripId);
  if (!assigns) return null;
  if (seatNumber == null || !isValidSeatNumber(seatNumber)) {
    throw new SeatRequiredError();
  }
  const taken = await occupiedSeatNumbers(db, tripId, exceptTicketId);
  if (taken.has(seatNumber)) throw new SeatTakenError(seatNumber);
  return seatNumber;
}
