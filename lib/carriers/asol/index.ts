import type {
  BookingRequest,
  BookingStatus,
  CarrierAdapter,
  SearchQuery,
} from "@/lib/carriers/types";
import type { Trip } from "@/lib/mockTrips";
import { occupiedSeatNumbers } from "@/lib/tickets/inventory";
import { priceForTrip } from "@/lib/pricing/grid";
import { prisma } from "@/lib/db";
import {
  listInternalTrips,
  upcomingInternalTrips,
  type InternalTripOption,
} from "@/lib/trips/internal";

function hhmm(iso: string): string {
  return new Date(iso).toISOString().slice(11, 16);
}

function durationMinutes(fromIso: string, toIso: string): number {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  return Math.max(1, Math.round(ms / 60000));
}

async function toSearchTrip(option: InternalTripOption): Promise<Trip> {
  const assigns = option.hasAssignedSeats;
  let seatsLeft = 46;
  if (assigns) {
    const taken = await occupiedSeatNumbers(prisma, option.id);
    seatsLeft = Math.max(0, 46 - taken.size);
  }
  const { price, breakdown } = await priceForTrip(prisma, {
    id: option.id,
    price: option.price,
    departureTime: new Date(option.departureTime),
  });
  return {
    id: option.id,
    carrierId: "asol",
    carrier: option.carrier,
    carrierShort: "AB",
    busType: option.bus ?? "Setra S 516 HD",
    from: option.fromCity,
    to: option.toCity,
    departure: hhmm(option.departureTime),
    arrival: hhmm(option.arrivalTime),
    durationMinutes: durationMinutes(option.departureTime, option.arrivalTime),
    price,
    currency: "EUR",
    seatsLeft,
    amenities: ["Wi-Fi", "USB", "A/C", "WC"],
    rating: 4.8,
    hasAssignedSeats: assigns,
    priceTier: breakdown ? breakdown.tierIndex + 1 : undefined,
    pricePhase: breakdown?.phase,
  };
}

export class AsolCarrierAdapter implements CarrierAdapter {
  readonly id = "asol";
  readonly name = "Asol BUS";

  async search(query: SearchQuery): Promise<Trip[]> {
    const options = query.date
      ? await listInternalTrips({
          fromCity: query.from,
          toCity: query.to,
          date: query.date,
        })
      : await upcomingInternalTrips({
          fromCity: query.from,
          toCity: query.to,
          take: 20,
        });
    const trips: Trip[] = [];
    for (const option of options) {
      trips.push(await toSearchTrip(option));
    }
    return trips;
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
