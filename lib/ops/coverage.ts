import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { pickAssignment, toAssignmentView, type AssignmentView } from "@/lib/ops/legs";

/**
 * Map a sold segment (stop indices on the departure) onto operational legs.
 * One leg → single bus. Two legs → transfer at the boundary stop.
 */
export type LegCoverage = {
  legId: string;
  label: string;
  fromIndex: number;
  toIndex: number;
  fromCity: string;
  toCity: string;
  assignment: AssignmentView | null;
};

export type SegmentCoverage = {
  legs: LegCoverage[];
  transferCity: string | null;
};

type Db = PrismaClient | Prisma.TransactionClient;

export async function coverSegment(options: {
  db?: Db;
  tripId: string;
  fromIndex: number;
  toIndex: number;
  destinationLabel?: string | null;
}): Promise<SegmentCoverage> {
  const db = options.db ?? prisma;
  const empty: SegmentCoverage = { legs: [], transferCity: null };

  const trip = await db.trip.findUnique({
    where: { id: options.tripId },
    select: {
      departure: {
        select: {
          id: true,
          stops: { orderBy: { sortOrder: "asc" } },
          legs: {
            orderBy: { order: "asc" },
            include: {
              assignments: {
                where: { active: true },
                include: { bus: true, zones: true },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      },
    },
  });
  const departure = trip?.departure;
  if (!departure || departure.legs.length <= 1) {
    // No operational split — the whole run is one implicit leg.
    if (departure?.legs.length === 1) {
      const leg = departure.legs[0];
      const assignment = leg.assignments[0]
        ? toAssignmentView(leg.assignments[0])
        : null;
      return {
        legs: [
          {
            legId: leg.id,
            label: leg.label,
            fromIndex: options.fromIndex,
            toIndex: options.toIndex,
            fromCity: "",
            toCity: "",
            assignment,
          },
        ],
        transferCity: null,
      };
    }
    return empty;
  }

  const stopIndexById = new Map(
    departure.stops.map((s, i) => [s.id, i] as const)
  );
  const legRanges = departure.legs.map((leg) => ({
    leg,
    from: leg.fromStopId ? (stopIndexById.get(leg.fromStopId) ?? 0) : 0,
    to: leg.toStopId
      ? (stopIndexById.get(leg.toStopId) ?? departure.stops.length - 1)
      : departure.stops.length - 1,
  }));

  // DIRECT: when the first covering leg's assignment is direct to the
  // passenger's destination, the whole sale stays on that one bus.
  const first = legRanges.find(
    ({ from, to }) => from <= options.fromIndex && options.fromIndex < to
  );
  if (first) {
    for (const row of first.leg.assignments) {
      if (
        row.isDirect &&
        row.directDestinationCity &&
        options.destinationLabel &&
        row.directDestinationCity.trim().toLowerCase() ===
          options.destinationLabel.trim().toLowerCase()
      ) {
        return {
          legs: [
            {
              legId: first.leg.id,
              label: first.leg.label,
              fromIndex: options.fromIndex,
              toIndex: options.toIndex,
              fromCity: departure.stops[options.fromIndex]?.city ?? "",
              toCity: departure.stops[options.toIndex]?.city ?? "",
              assignment: toAssignmentView(row),
            },
          ],
          transferCity: null,
        };
      }
    }
  }

  const covered: LegCoverage[] = [];
  let transferCity: string | null = null;
  for (const { leg, from, to } of legRanges) {
    if (from < options.toIndex && options.fromIndex < to) {
      const assignment = leg.assignments.length
        ? (await pickAssignment({
            db,
            legId: leg.id,
            seatNumber: null,
            destinationLabel: options.destinationLabel,
          })) ?? toAssignmentView(leg.assignments[0])
        : null;
      covered.push({
        legId: leg.id,
        label: leg.label,
        fromIndex: Math.max(from, options.fromIndex),
        toIndex: Math.min(to, options.toIndex),
        fromCity: departure.stops[Math.max(from, options.fromIndex)]?.city ?? "",
        toCity: departure.stops[Math.min(to, options.toIndex)]?.city ?? "",
        assignment,
      });
    }
  }
  if (covered.length > 1) {
    transferCity = covered[0].toCity || null;
  }
  return { legs: covered, transferCity };
}
