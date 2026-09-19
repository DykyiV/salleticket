import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildLayout, parseCoachLayout } from "@/lib/seats";
import {
  FULL_ROUTE,
  segmentsOverlap,
  type Segment,
} from "@/lib/trips/segments";

/**
 * Operational layer: legs (плечі), vehicle assignments, seat zones.
 * Names always come from the DB — nothing is hardcoded.
 */

type Db = PrismaClient | Prisma.TransactionClient;

const ACTIVE_TICKETS = ["RESERVED", "AWAITING_PAYMENT", "PAID_ONLINE", "PAID_CASH"] as const;

export type AssignmentView = {
  id: string;
  busId: string;
  busPlate: string;
  busModel: string | null;
  capacity: number;
  isDirect: boolean;
  directDestinationCity: string | null;
  allowCrossZoneSales: boolean;
  active: boolean;
  zones: { id: string; name: string; fromSeat: number; toSeat: number; groupLabel: string | null }[];
};

export function toAssignmentView(a: {
  id: string;
  busId: string;
  isDirect: boolean;
  directDestinationCity: string | null;
  allowCrossZoneSales: boolean;
  active: boolean;
  bus: { plate: string; model: string | null; layout: string };
  zones: { id: string; name: string; fromSeat: number; toSeat: number; groupLabel: string | null }[];
}): AssignmentView {
  return {
    id: a.id,
    busId: a.busId,
    busPlate: a.bus.plate,
    busModel: a.bus.model,
    capacity: buildLayout(parseCoachLayout(a.bus.layout)).seatCount,
    isDirect: a.isDirect,
    directDestinationCity: a.directDestinationCity,
    allowCrossZoneSales: a.allowCrossZoneSales,
    active: a.active,
    zones: a.zones,
  };
}

export async function legsForDeparture(
  departureId: string,
  db: Db = prisma
) {
  return db.leg.findMany({
    where: { departureId },
    include: {
      assignments: {
        include: { bus: true, zones: true },
        orderBy: { createdAt: "asc" },
      },
      trips: true,
    },
    orderBy: { order: "asc" },
  });
}

/** Sold seats on one assignment (TicketLegs + legacy tickets), segment-aware. */
export async function soldOnAssignment(
  db: Db,
  assignmentId: string,
  segment: Segment = FULL_ROUTE
): Promise<Set<number>> {
  const legs = await db.ticketLeg.findMany({
    where: {
      assignmentId,
      seatNumber: { not: null },
      ticket: { status: { in: [...ACTIVE_TICKETS] } },
    },
    select: { seatNumber: true, fromStopIndex: true, toStopIndex: true },
  });
  const taken = new Set<number>();
  for (const leg of legs) {
    const seg = {
      fromIndex: leg.fromStopIndex ?? FULL_ROUTE.fromIndex,
      toIndex: leg.toStopIndex ?? FULL_ROUTE.toIndex,
    };
    if (segmentsOverlap(seg, segment) && leg.seatNumber != null) {
      taken.add(leg.seatNumber);
    }
  }
  return taken;
}

/** Passenger distribution by final destination for one assignment. */
export async function destinationDistribution(
  db: Db,
  assignmentId: string
): Promise<{ destination: string; count: number }[]> {
  const legs = await db.ticketLeg.findMany({
    where: {
      assignmentId,
      ticket: { status: { in: [...ACTIVE_TICKETS] } },
    },
    select: {
      ticket: {
        select: {
          toCity: true,
          trip: { select: { toCity: true } },
        },
      },
    },
  });
  const counts = new Map<string, number>();
  for (const row of legs) {
    const destination = row.ticket.toCity ?? row.ticket.trip?.toCity ?? "—";
    counts.set(destination, (counts.get(destination) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([destination, count]) => ({ destination, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Pick the assignment for a new sale on a leg: first active assignment
 * where the seat is free on the segment and the destination's zone rules
 * allow it. When the first bus is full, sales spill into the next one.
 */
export async function pickAssignment(options: {
  db: Db;
  legId: string;
  seatNumber: number | null;
  segment?: Segment;
  destinationLabel?: string | null;
}): Promise<AssignmentView | null> {
  const leg = await options.db.leg.findUnique({
    where: { id: options.legId },
    include: {
      assignments: {
        where: { active: true },
        include: { bus: true, zones: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!leg) return null;
  const segment = options.segment ?? FULL_ROUTE;

  for (const row of leg.assignments) {
    const assignment = toAssignmentView(row);
    if (options.seatNumber != null) {
      if (options.seatNumber > assignment.capacity) continue;
      const zone = zoneForDestination(assignment, options.destinationLabel);
      if (zone && (options.seatNumber < zone.fromSeat || options.seatNumber > zone.toSeat)) {
        if (!assignment.allowCrossZoneSales) continue;
        const zoneTaken = await soldOnAssignment(options.db, assignment.id, segment);
        const zoneFree = [...Array(zone.toSeat - zone.fromSeat + 1)].some(
          (_, i) => !zoneTaken.has(zone.fromSeat + i)
        );
        if (zoneFree) continue; // stay in your zone while it has seats
      }
      const taken = await soldOnAssignment(options.db, assignment.id, segment);
      if (taken.has(options.seatNumber)) continue;
    }
    return assignment;
  }
  return null;
}

/** Zone matching a destination label (city or country name, editable data). */
export function zoneForDestination(
  assignment: AssignmentView,
  destinationLabel?: string | null
): AssignmentView["zones"][number] | null {
  if (!assignment.zones.length || !destinationLabel) return null;
  const needle = destinationLabel.trim().toLowerCase();
  return (
    assignment.zones.find(
      (z) => z.groupLabel && z.groupLabel.trim().toLowerCase() === needle
    ) ?? null
  );
}
