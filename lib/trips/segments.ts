import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addUtcDays, combineUtcDateTime, utcDateOnly } from "@/lib/routes/dates";
import { cityNames } from "@/lib/trips/cities";

/**
 * Segment seat inventory: one physical seat can be sold to different
 * passengers on different legs of the same run (Київ→Львів, Львів→Берлін…).
 * Stop indices are positions within the departure's stop list for the
 * trip's direction (outbound: sortOrder asc; return: desc).
 */

type Db = PrismaClient | Prisma.TransactionClient;

export type Segment = { fromIndex: number; toIndex: number };

export const FULL_ROUTE: Segment = { fromIndex: 0, toIndex: 999 };

export function segmentsOverlap(a: Segment, b: Segment): boolean {
  return a.fromIndex < b.toIndex && b.fromIndex < a.toIndex;
}

type StopRow = {
  sortOrder: number;
  city: string;
  outboundDay: number;
  outboundTime: string;
  returnDay: number;
  returnTime: string;
  isVisible: boolean;
  saleEnabled: boolean;
};

async function stopsForTrip(db: Db, tripId: string) {
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      fromCity: true,
      departureId: true,
      departure: {
        select: {
          date: true,
          allowSegmentSales: true,
          template: { select: { destinationCity: true } },
          stops: {
            where: { isVisible: true, saleEnabled: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });
  if (!trip?.departure) return null;
  const isReturn = trip.fromCity === trip.departure.template.destinationCity;
  const ordered = isReturn
    ? [...trip.departure.stops].reverse()
    : trip.departure.stops;
  return { trip, isReturn, stops: ordered, departure: trip.departure };
}

/** Resolve two cities to stop indices on the trip's direction. */
export async function resolveSegment(
  db: Db,
  tripId: string,
  fromCity: string,
  toCity: string
): Promise<Segment | null> {
  const ctx = await stopsForTrip(db, tripId);
  if (!ctx) return null;
  const fromNames = cityNames(fromCity).map((c) => c.toLowerCase());
  const toNames = cityNames(toCity).map((c) => c.toLowerCase());
  const fromIndex = ctx.stops.findIndex((s) =>
    fromNames.includes(s.city.toLowerCase())
  );
  const toIndex = ctx.stops.findIndex((s) =>
    toNames.includes(s.city.toLowerCase())
  );
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= toIndex) return null;
  return { fromIndex, toIndex };
}

export type SegmentTripOption = {
  tripId: string;
  departureId: string;
  fromCity: string;
  toCity: string;
  fromStopIndex: number;
  toStopIndex: number;
  departureTime: string;
  arrivalTime: string;
  hasAssignedSeats: boolean;
};

/** All runs on a date where from→to is a sellable segment. */
export async function findSegmentTrips(options: {
  fromCity: string;
  toCity: string;
  date: string;
  db?: Db;
}): Promise<SegmentTripOption[]> {
  const db = options.db ?? prisma;
  const day = utcDateOnly(options.date);
  const next = addUtcDays(day, 1);

  const departures = await db.departure.findMany({
    where: {
      date: { gte: day, lt: next },
      allowSegmentSales: true,
      template: { isActive: true },
    },
    include: {
      stops: {
        where: { isVisible: true, saleEnabled: true },
        orderBy: { sortOrder: "asc" },
      },
      trips: true,
      template: { select: { originCity: true, destinationCity: true } },
    },
  });

  const fromNames = cityNames(options.fromCity).map((c) => c.toLowerCase());
  const toNames = cityNames(options.toCity).map((c) => c.toLowerCase());
  const out: SegmentTripOption[] = [];

  for (const departure of departures) {
    for (const trip of departure.trips) {
      const isReturn = trip.fromCity === departure.template.destinationCity;
      const stops = isReturn
        ? [...departure.stops].reverse()
        : departure.stops;
      const fromIndex = stops.findIndex((s) =>
        fromNames.includes(s.city.toLowerCase())
      );
      const toIndex = stops.findIndex((s) =>
        toNames.includes(s.city.toLowerCase())
      );
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= toIndex) continue;

      const fromStop = stops[fromIndex];
      const toStop = stops[toIndex];
      const departureTime = isReturn
        ? combineUtcDateTime(departure.date, fromStop.returnDay, fromStop.returnTime)
        : combineUtcDateTime(departure.date, fromStop.outboundDay, fromStop.outboundTime);
      let arrivalTime = isReturn
        ? combineUtcDateTime(departure.date, toStop.returnDay, toStop.returnTime)
        : combineUtcDateTime(departure.date, toStop.outboundDay, toStop.outboundTime);
      if (arrivalTime <= departureTime) {
        arrivalTime = new Date(departureTime.getTime() + 2 * 3_600_000);
      }

      out.push({
        tripId: trip.id,
        departureId: departure.id,
        fromCity: fromStop.city,
        toCity: toStop.city,
        fromStopIndex: fromIndex,
        toStopIndex: toIndex,
        departureTime: departureTime.toISOString(),
        arrivalTime: arrivalTime.toISOString(),
        hasAssignedSeats: departure.hasAssignedSeats,
      });
    }
  }

  return out.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
}
