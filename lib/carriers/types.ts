import type { Trip, TransportType } from "@/lib/mockTrips";

export type { Trip, TransportType };

export type SearchQuery = {
  from: string;
  to: string;
  date?: string;
  passengers?: number;
  /**
   * When set, only carriers serving this transport type are queried.
   * Omit to fan out across every registered carrier (all transport types).
   */
  transport?: TransportType;
};

export type SearchResult = {
  trips: Trip[];
  carrierId: string;
  carrierName: string;
  /**
   * If the upstream call failed, we still return an entry so callers can
   * surface partial results and report which carriers errored out.
   */
  error?: string;
};

export type BookingPassenger = {
  name: string;
  phone: string;
  email?: string;
};

export type BookingRequest = {
  tripId: string;
  carrierId: string;
  passenger: BookingPassenger;
  /** Cached trip snapshot from the search step (for carriers without a persistent trip store). */
  tripSnapshot?: Partial<Trip>;
};

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "failed"
  | "cancelled";

export type BookingRecord = {
  reference: string;
  status: BookingStatus;
  createdAt: string;
  carrierId: string;
  carrierName: string;
  tripId: string;
  passenger: BookingPassenger;
  trip: {
    from: string;
    to: string;
    departure: string;
    arrival: string;
    price: number;
    currency: string;
  };
  totalPaid: number;
};

/**
 * Adapter every carrier integration must implement.
 *
 * Current implementations:
 *   - MockCarrierAdapter  (lib/carriers/mock)        — buses
 *   - MockFlightAdapter   (lib/carriers/mock-flights) — flights
 *   - MockTrainAdapter    (lib/carriers/mock-trains)  — trains
 *
 * Real integrations (airline GDS, rail APIs, bus networks) plug in here:
 * implement this interface, set `transportType`, register in registry.ts.
 */
export interface CarrierAdapter {
  readonly id: string;
  readonly name: string;
  /** Which transport type this carrier sells. */
  readonly transportType: TransportType;

  search(query: SearchQuery): Promise<Trip[]>;

  /**
   * Create a booking with the upstream carrier. Returns the carrier-side
   * reference (PNR) and status. The outer booking store wraps this with its
   * own reference for users.
   */
  book(
    request: BookingRequest
  ): Promise<{
    carrierReference: string;
    status: BookingStatus;
    confirmedTrip: BookingRecord["trip"];
  }>;
}
