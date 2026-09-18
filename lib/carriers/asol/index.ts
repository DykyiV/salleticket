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
import { upcomingInternalTrips } from "@/lib/trips/internal";

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
  return {
    id: option.tripId,
    carrierId: "asol",
    carrier: "Asol BUS",
    carrierShort: "AB",
    busType: "Setra S 516 HD",
    from: option.fromCity,
    to: option.toCity,
    departure: hhmm(option.departureTime),
    arrival: hhmm(option.arrivalTime),
    durationMinutes: durationMinutes(option.departureTime, option.arrivalTime),
    price: priced.price,
    currency: "EUR",
    seatsLeft,
    amenities: ["Wi-Fi", "USB", "A/C", "WC"],
    rating: 4.8,
    hasAssignedSeats: option.hasAssignedSeats,
    priceTier: priced.breakdown ? priced.breakdown.tierIndex + 1 : undefined,
    pricePhase: priced.breakdown?.phase,
    fromStopIndex: option.fromStopIndex,
    toStopIndex: option.toStopIndex,
  };
}

export class AsolCarrierAdapter implements CarrierAdapter {
  readonly id = "asol";
  readonly name = "Asol BUS";

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
