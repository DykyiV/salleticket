import { getMockTrains, type Trip } from "@/lib/mockTrips";
import type {
  BookingRequest,
  BookingStatus,
  CarrierAdapter,
  SearchQuery,
} from "@/lib/carriers/types";

/**
 * Mock rail adapter. Simulates a rail inventory + reservation API.
 * Replace with a real rail carrier integration (e.g. national railway API)
 * by implementing the same CarrierAdapter interface.
 */
export class MockTrainAdapter implements CarrierAdapter {
  readonly id = "mock-rail";
  readonly name = "Asol Mock Rail";
  readonly transportType = "TRAIN" as const;

  async search(query: SearchQuery): Promise<Trip[]> {
    return getMockTrains(query.from, query.to);
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
      carrierReference: `RAIL-${Math.random()
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

export const mockTrainAdapter = new MockTrainAdapter();
