import { getMockTrips, type Trip } from "@/lib/mockTrips";
import { searchRealTrips } from "@/lib/routes/search";
import type {
  BookingRequest,
  BookingStatus,
  CarrierAdapter,
  SearchQuery,
} from "@/lib/carriers/types";

/**
 * Internal "mock" adapter — `id: "mock"` is really just "handled in-process
 * by this app" rather than a call to an external carrier's API. It searches
 * real DB-backed trips generated from admin-managed Route templates
 * (lib/routes/search.ts) first, and only falls back to fully-fake in-memory
 * trips (lib/mockTrips.ts) when no Route templates have been created yet, so
 * the site still shows something before an admin sets up routes.
 *
 * `book()` still fabricates a carrier PNR — there is no external carrier
 * behind this adapter (yet). Real inventory (seat claiming, ticket/booking
 * rows) is persisted by app/api/booking/route.ts, not here; a future real
 * carrier adapter (FlixBusAdapter, GunselAdapter, ...) would instead call
 * out to that carrier's booking API and return their PNR.
 */
export class MockCarrierAdapter implements CarrierAdapter {
  readonly id = "mock";
  readonly name = "Asol Mock Network";

  async search(query: SearchQuery): Promise<Trip[]> {
    const real = await searchRealTrips(query);
    if (real.length > 0) return real;
    return getMockTrips(query.from, query.to);
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
