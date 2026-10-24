import type {
  BookingRequest,
  BookingStatus,
  CarrierAdapter,
  SearchQuery,
} from "@/lib/carriers/types";
import type { Trip } from "@/lib/mockTrips";
import { occupiedSeatNumbers, seatCapacity } from "@/lib/tickets/inventory";
import { priceForTrip } from "@/lib/pricing/grid";
import { prisma } from "@/lib/db";
import { findSegmentTrips, type SegmentTripOption } from "@/lib/trips/segments";
import { coverSegment } from "@/lib/ops/coverage";
import { upcomingInternalTrips } from "@/lib/trips/internal";
import {
  commonFeatures,
  isBusCategory,
  parseBusFeatures,
  type BusCategory,
} from "@/lib/buses/features";

const LEGACY_AMENITY_LABEL: Record<string, string> = {
  wifi: "Wi-Fi",
  sockets: "USB",
  ac: "A/C",
  wc: "WC",
  water: "Water",
};

type BusInfo = { model: string | null; category: string; amenities: string; luggagePieces: number };

/** Carrier and bus(es) behind a sold segment: the leg buses, else the run's bus. */
async function vehicleInfo(tripId: string, assignmentIds: string[]) {
  const [trip, assignments] = await Promise.all([
    prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        carrier: { select: { name: true } },
        departure: {
          select: {
            defaultBus: true,
            bus: { select: { model: true, category: true, amenities: true, luggagePieces: true } },
          },
        },
      },
    }),
    assignmentIds.length
      ? prisma.vehicleAssignment.findMany({
          where: { id: { in: assignmentIds } },
          select: { bus: { select: { model: true, category: true, amenities: true, luggagePieces: true } } },
        })
      : Promise.resolve([] as { bus: BusInfo }[]),
  ]);
  const buses: BusInfo[] = assignments.length
    ? assignments.map((a) => a.bus)
    : trip?.departure?.bus
      ? [trip.departure.bus]
      : [];
  const first = buses[0];
  const category: BusCategory | undefined =
    first && isBusCategory(first.category) ? first.category : undefined;
  return {
    carrier: trip?.carrier.name ?? "Asol BUS",
    busModel: first?.model ?? trip?.departure?.defaultBus ?? null,
    category,
    features: buses.length ? commonFeatures(buses.map((b) => parseBusFeatures(b.amenities))) : undefined,
    luggagePieces: buses.length ? Math.min(...buses.map((b) => b.luggagePieces)) : undefined,
  };
}

function shortName(name: string): string {
  const words = name.trim().split(/\s+/);
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
}

function hhmm(iso: string): string {
  return new Date(iso).toISOString().slice(11, 16);
}

function durationMinutes(fromIso: string, toIso: string): number {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  return Math.max(1, Math.round(ms / 60000));
}

async function toSearchTrip(option: SegmentTripOption): Promise<Trip> {
  const segment = {
    fromIndex: option.fromStopIndex,
    toIndex: option.toStopIndex,
  };
  const [taken, capacity, priced] = await Promise.all([
    occupiedSeatNumbers(prisma, option.tripId, undefined, segment),
    seatCapacity(prisma, option.tripId),
    priceForTrip(prisma, {
      id: option.tripId,
      price: 99,
      departureTime: new Date(option.departureTime),
    }),
  ]);
  const seatsLeft = option.hasAssignedSeats
    ? Math.max(0, capacity - taken.size)
    : 46;
  const coverage = await coverSegment({
    tripId: option.tripId,
    fromIndex: option.fromStopIndex,
    toIndex: option.toStopIndex,
    destinationLabel: option.toCity,
  });
  const vehicle = await vehicleInfo(
    option.tripId,
    coverage.legs.map((l) => l.assignment?.id).filter((id): id is string => Boolean(id))
  );
  const legCount = Math.max(1, coverage.legs.length);
  return {
    id: option.tripId,
    carrierId: "asol",
    carrier: vehicle.carrier,
    carrierShort: shortName(vehicle.carrier),
    busType: vehicle.busModel ?? "",
    transportType: "BUS",
    from: option.fromCity,
    to: option.toCity,
    departure: hhmm(option.departureTime),
    arrival: hhmm(option.arrivalTime),
    durationMinutes: durationMinutes(option.departureTime, option.arrivalTime),
    price: priced.price,
    currency: "EUR",
    seatsLeft,
    amenities: (vehicle.features ?? []).map((f) => LEGACY_AMENITY_LABEL[f] ?? f),
    rating: 4.8,
    hasAssignedSeats: option.hasAssignedSeats,
    priceTier: priced.breakdown ? priced.breakdown.tierIndex + 1 : undefined,
    pricePhase: priced.breakdown?.phase,
    fromStopIndex: option.fromStopIndex,
    toStopIndex: option.toStopIndex,
    transferCity: coverage.transferCity ?? undefined,
    departureAt: option.departureTime,
    arrivalAt: option.arrivalTime,
    fromStation: option.fromStation,
    toStation: option.toStation,
    busCategory: vehicle.category,
    features: vehicle.features,
    luggagePieces: vehicle.luggagePieces,
    transfers: coverage.transferCity ? Math.max(1, legCount - 1) : 0,
    legSegments: coverage.legs.map((leg) => ({
      legId: leg.legId,
      label: leg.label,
      fromIndex: leg.fromIndex,
      toIndex: leg.toIndex,
      fromCity: leg.fromCity,
      toCity: leg.toCity,
      assignmentId: leg.assignment?.id,
      busPlate: leg.assignment?.busPlate,
      isDirect: leg.assignment?.isDirect,
    })),
  };
}

export class AsolCarrierAdapter implements CarrierAdapter {
  readonly id = "asol";
  readonly name = "Asol BUS";
  readonly transportType = "BUS" as const;

  async search(query: SearchQuery): Promise<Trip[]> {
    // Segment search: any stop → any later stop of the same run.
    if (query.date) {
      const segments = await findSegmentTrips({
        fromCity: query.from,
        toCity: query.to,
        date: query.date,
      });
      const trips: Trip[] = [];
      for (const option of segments) {
        trips.push(await toSearchTrip(option));
      }
      return trips;
    }
    const upcoming = await upcomingInternalTrips({
      fromCity: query.from,
      toCity: query.to,
      take: 20,
    });
    return Promise.all(
      upcoming.map((option) =>
        toSearchTrip({
          tripId: option.id,
          departureId: "",
          fromCity: option.fromCity,
          toCity: option.toCity,
          fromStopIndex: 0,
          toStopIndex: 999,
          departureTime: option.departureTime,
          arrivalTime: option.arrivalTime,
          hasAssignedSeats: option.hasAssignedSeats,
        })
      )
    );
  }

  async book(request: BookingRequest): Promise<{
    carrierReference: string;
    status: BookingStatus;
    confirmedTrip: {
      from: string;
      to: string;
      departure: string;
      arrival: string;
      price: number;
      currency: string;
    };
  }> {
    const snapshot = request.tripSnapshot ?? {};
    return {
      carrierReference: `ASOL-${Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase()}`,
      status: "confirmed",
      confirmedTrip: {
        from: snapshot.from ?? "",
        to: snapshot.to ?? "",
        departure: snapshot.departure ?? "",
        arrival: snapshot.arrival ?? "",
        price: snapshot.price ?? 0,
        currency: snapshot.currency ?? "EUR",
      },
    };
  }
}

export const asolCarrierAdapter = new AsolCarrierAdapter();
