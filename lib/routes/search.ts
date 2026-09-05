import { prisma } from "@/lib/db";
import { ensureUpcomingTrips } from "@/lib/routes/generate";
import type { Trip } from "@/lib/mockTrips";

/** "Grandes Tour" -> "GT", "FlixBus" -> "FB". Best-effort, display only. */
function abbreviate(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (initials || name.slice(0, 2).toUpperCase()).slice(0, 3);
}

function toHHMM(date: Date): string {
  return date.toISOString().slice(11, 16);
}

export type SearchTripsQuery = {
  from: string;
  to: string;
  date?: string;
};

/**
 * Real, DB-backed trip search: generates upcoming trips from active Route
 * templates (idempotent, cheap once generated) and returns the ones matching
 * from/to (case-insensitive substring) and, if given, the exact calendar
 * date. Returns [] when no Route templates are active yet — callers should
 * fall back to the legacy mock generator (`lib/mockTrips.ts`) in that case.
 */
export async function searchRealTrips(query: SearchTripsQuery): Promise<Trip[]> {
  await ensureUpcomingTrips();

  const from = query.from.trim();
  const to = query.to.trim();

  const dateRange = query.date
    ? (() => {
        const day = new Date(`${query.date}T00:00:00.000Z`);
        if (Number.isNaN(day.getTime())) return null;
        const next = new Date(day);
        next.setUTCDate(next.getUTCDate() + 1);
        return { gte: day, lt: next };
      })()
    : null;

  const trips = await prisma.trip.findMany({
    where: {
      routeId: { not: null },
      fromCity: { contains: from },
      toCity: { contains: to },
      departureTime: dateRange ?? { gte: new Date() },
    },
    include: {
      carrier: true,
      route: true,
      seats: { select: { status: true } },
    },
    orderBy: { departureTime: "asc" },
    take: 50,
  });

  return trips.map((trip) => {
    const seatsLeft = trip.seats.filter((s) => s.status === "AVAILABLE").length;
    const amenities = (trip.route?.amenities ?? "")
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    return {
      id: trip.id,
      carrierId: "mock",
      carrier: trip.carrier.name,
      carrierShort: abbreviate(trip.carrier.name),
      busType: trip.route?.busType ?? "Autobus",
      from: trip.fromCity,
      to: trip.toCity,
      departure: toHHMM(trip.departureTime),
      arrival: toHHMM(trip.arrivalTime),
      durationMinutes: Math.max(
        1,
        Math.round((trip.arrivalTime.getTime() - trip.departureTime.getTime()) / 60_000)
      ),
      price: trip.price,
      currency: "EUR",
      seatsLeft,
      amenities,
      rating: trip.carrier.rating,
    } satisfies Trip;
  });
}
