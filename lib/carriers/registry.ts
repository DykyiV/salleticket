import { mockCarrierAdapter } from "@/lib/carriers/mock";
import type {
  CarrierAdapter,
  SearchQuery,
  SearchResult,
} from "@/lib/carriers/types";

/**
 * Registry of all enabled carrier adapters. Add new carriers here by
 * implementing CarrierAdapter and importing them. Each adapter is queried in
 * parallel during a search; failures are isolated per-carrier.
 *
 * Future integrations can be toggled via env vars:
 *   - CARRIER_FLIXBUS_ENABLED=true
 *   - CARRIER_GUNSEL_API_KEY=...
 */
const registry: CarrierAdapter[] = [mockCarrierAdapter];

export function listCarriers(): CarrierAdapter[] {
  return [...registry];
}

export function findCarrier(id: string): CarrierAdapter | undefined {
  return registry.find((c) => c.id === id);
}

export async function searchAllCarriers(
  query: SearchQuery
): Promise<SearchResult[]> {
  const settled = await Promise.allSettled(
    registry.map(async (carrier) => {
      const trips = await carrier.search(query);
      return {
        carrierId: carrier.id,
        carrierName: carrier.name,
        trips,
      } satisfies SearchResult;
    })
  );

  return settled.map((outcome, index) => {
    const carrier = registry[index];
    if (outcome.status === "fulfilled") return outcome.value;
    return {
      carrierId: carrier.id,
      carrierName: carrier.name,
      trips: [],
      error:
        outcome.reason instanceof Error
          ? outcome.reason.message
          : "Unknown carrier error",
    };
  });
}
