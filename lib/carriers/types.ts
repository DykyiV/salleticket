import type { Trip } from "@/lib/mockTrips";

export type { Trip };

export type SearchQuery = {
  from: string;
  to: string;
  date?: string;
  passengers?: number;
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
 *   - MockCarrierAdapter (lib/carriers/mock)
 *
 * Planned implementations (see docs/future-integrations):
 *   - FlixBusAdapter
 *   - GunselAdapter
 *   - EuroLinesAdapter
 */
export interface CarrierAdapter {
  readonly id: string;
  readonly name: string;

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
