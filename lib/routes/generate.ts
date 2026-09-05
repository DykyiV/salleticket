/**
 * Turns Route templates into concrete, bookable Trip rows (+ their Seat
 * inventory) for actual calendar dates. This is what makes search results
 * and seat maps real instead of mock: a Route is a recurring schedule
 * ("Vinnytsia — Sevilla, departs 19:30, Mon/Thu"), a Trip is one dated
 * departure of it, generated ahead of time so every booking claims a seat on
 * a shared row instead of creating its own private Trip (see
 * app/api/booking/route.ts for the seat-claim transaction).
 */

import { prisma } from "@/lib/db";
import { buildSeatSlots } from "@/lib/seats/layout";

/** How many days ahead to keep trips generated for. Idempotent — re-running
 * with the same window only fills in gaps, never duplicates. */
export const GENERATE_HORIZON_DAYS = 30;

function parseDaysOfWeek(csv: string): Set<number> {
  return new Set(
    csv
      .split(",")
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
  );
}

/** ISO weekday for a UTC-midnight date: 1=Monday..7=Sunday. */
function isoWeekday(date: Date): number {
  const day = date.getUTCDay(); // 0=Sunday..6=Saturday
  return day === 0 ? 7 : day;
}

function combine(dateUtcMidnight: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map((v) => Number.parseInt(v, 10) || 0);
  const d = new Date(dateUtcMidnight);
  d.setUTCHours(h, m, 0, 0);
  return d;
}

/**
 * Ensure every active Route has a generated Trip (with seats) for each date
 * in the next `horizonDays` that matches its `daysOfWeek`. Safe to call as
 * often as you like (e.g. lazily from the search endpoint, or from a cron) —
 * it only creates what's missing.
 */
export async function ensureUpcomingTrips(
  horizonDays: number = GENERATE_HORIZON_DAYS
): Promise<{ created: number }> {
  const routes = await prisma.route.findMany({
    where: { isActive: true },
    include: { stops: { orderBy: { order: "asc" } } },
  });
  if (routes.length === 0) return { created: 0 };

  const today = new Date();
  const todayUtcMidnight = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );

  let created = 0;

  for (const route of routes) {
    const allowedWeekdays = parseDaysOfWeek(route.daysOfWeek);
    if (allowedWeekdays.size === 0) continue;

    const lastStop = route.stops[route.stops.length - 1];
    const arrivalOffset = lastStop?.offsetMinutes ?? 0;

    for (let i = 0; i < horizonDays; i++) {
      const date = new Date(todayUtcMidnight);
      date.setUTCDate(date.getUTCDate() + i);
      if (!allowedWeekdays.has(isoWeekday(date))) continue;

      const departureAt = combine(date, route.departureTime);
      // Skip departures already in the past today (route runs today but the
      // scheduled time has passed).
      if (departureAt.getTime() < Date.now()) continue;

      const existing = await prisma.trip.findFirst({
        where: { routeId: route.id, departureTime: departureAt },
        select: { id: true },
      });
      if (existing) continue;

      const arrivalAt = new Date(departureAt.getTime() + arrivalOffset * 60_000);
      const seatSlots = buildSeatSlots(route.busCapacity);

      await prisma.trip.create({
        data: {
          fromCity: route.fromCity,
          toCity: route.toCity,
          departureTime: departureAt,
          arrivalTime: arrivalAt > departureAt ? arrivalAt : new Date(departureAt.getTime() + 60_000),
          price: route.basePrice,
          carrierId: route.carrierId,
          routeId: route.id,
          seats: {
            create: seatSlots.map((slot) => ({
              number: slot.number,
              row: slot.row,
              side: slot.side,
              position: slot.position,
            })),
          },
        },
      });
      created++;
    }
  }

  return { created };
}
