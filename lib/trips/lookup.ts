import { prisma } from "@/lib/db";
import { searchAllCarriers } from "@/lib/carriers/registry";
import type { Trip } from "@/lib/carriers/types";
import { combineUtcDateTime } from "@/lib/routes/dates";

export type TripRef = {
  carrierId: string;
  tripId: string;
  from: string;
  to: string;
  date?: string;
  fromStopIndex?: number;
  toStopIndex?: number;
};

function intParam(v: string | undefined | null): number | undefined {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

/** Reads a trip reference from page search params (seat / checkout pages). */
export function tripRefFromParams(sp: Record<string, string | undefined>): TripRef | null {
  const tripId = sp.tripId?.trim();
  const from = sp.from?.trim();
  const to = sp.to?.trim();
  if (!tripId || !from || !to) return null;
  return {
    carrierId: sp.carrierId?.trim() || "asol",
    tripId,
    from,
    to,
    date: sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : undefined,
    fromStopIndex: intParam(sp.fi),
    toStopIndex: intParam(sp.ti),
  };
}

export function tripRefParams(ref: TripRef): URLSearchParams {
  const p = new URLSearchParams({ carrierId: ref.carrierId, tripId: ref.tripId, from: ref.from, to: ref.to });
  if (ref.date) p.set("date", ref.date);
  if (ref.fromStopIndex != null) p.set("fi", String(ref.fromStopIndex));
  if (ref.toStopIndex != null) p.set("ti", String(ref.toStopIndex));
  return p;
}

/**
 * The trip exactly as the search shows it (price, seats, bus) — looked up
 * on the server again, never taken from the address bar.
 */
export async function findSearchTrip(ref: TripRef): Promise<Trip | null> {
  const results = await searchAllCarriers({ from: ref.from, to: ref.to, date: ref.date, transport: "BUS" });
  const trips = results.flatMap((r) => r.trips).filter((t) => t.carrierId === ref.carrierId && t.id === ref.tripId);
  if (!trips.length) return null;
  return (
    trips.find((t) => ref.fromStopIndex == null || t.fromStopIndex === ref.fromStopIndex) ?? trips[0]
  );
}

export type TripStop = { city: string; address: string | null; at: string };

/** Boarding → drop-off stops of a sold segment, with times (DB trips only). */
export async function tripStops(tripId: string, fromIndex?: number, toIndex?: number): Promise<TripStop[]> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      fromCity: true,
      departure: {
        select: {
          date: true,
          template: { select: { destinationCity: true } },
          stops: {
            where: { isVisible: true, saleEnabled: true },
            orderBy: { sortOrder: "asc" },
            select: {
              city: true,
              addressLabel: true,
              boardingAddress: true,
              outboundDay: true,
              outboundTime: true,
              returnDay: true,
              returnTime: true,
            },
          },
        },
      },
    },
  });
  const dep = trip?.departure;
  if (!trip || !dep || !dep.stops.length) return [];
  const isReturn = trip.fromCity === dep.template.destinationCity;
  const stops = isReturn ? [...dep.stops].reverse() : dep.stops;
  const start = fromIndex ?? 0;
  const end = toIndex != null && toIndex < stops.length ? toIndex : stops.length - 1;
  return stops.slice(start, end + 1).map((s) => ({
    city: s.city,
    address: s.boardingAddress || s.addressLabel || null,
    at: (isReturn
      ? combineUtcDateTime(dep.date, s.returnDay, s.returnTime)
      : combineUtcDateTime(dep.date, s.outboundDay, s.outboundTime)
    ).toISOString(),
  }));
}
