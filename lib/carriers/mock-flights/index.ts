import { getMockFlights, type Trip } from "@/lib/mockTrips";
import type {
  BookingRequest,
  BookingStatus,
  CarrierAdapter,
  SearchQuery,
} from "@/lib/carriers/types";

/**
 * Mock airline adapter. Simulates a flight inventory + PNR booking API.
 * Replace with a real GDS / airline NDC integration by implementing the
 * same CarrierAdapter interface — the rest of the app needs no changes.
 */
export class MockFlightAdapter implements CarrierAdapter {
  readonly id = "mock-air";
  readonly name = "Asol Mock Airlines";
  readonly transportType = "FLIGHT" as const;

  async search(query: SearchQuery): Promise<Trip[]> {
    return getMockFlights(query.from, query.to);
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
      // Simulated airline PNR locator.
      carrierReference: `PNR-${Math.random()
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

export const mockFlightAdapter = new MockFlightAdapter();
