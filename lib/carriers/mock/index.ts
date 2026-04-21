import { getMockTrips, type Trip } from "@/lib/mockTrips";
import type {
  BookingRequest,
  BookingStatus,
  CarrierAdapter,
  SearchQuery,
} from "@/lib/carriers/types";

/**
 * Mock carrier adapter. Generates deterministic fake trips and simulates
 * booking with an in-memory fake PNR. Replace (or augment) with real carrier
 * adapters by implementing CarrierAdapter.
 */
export class MockCarrierAdapter implements CarrierAdapter {
  readonly id = "mock";
  readonly name = "Asol Mock Network";

  async search(query: SearchQuery): Promise<Trip[]> {
    const trips = getMockTrips(query.from, query.to);
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
      carrierReference: `MOCK-${Math.random()
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

export const mockCarrierAdapter = new MockCarrierAdapter();
