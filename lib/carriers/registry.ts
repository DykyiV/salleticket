import { asolCarrierAdapter } from "@/lib/carriers/asol";
import { mockCarrierAdapter } from "@/lib/carriers/mock";
import { mockFlightAdapter } from "@/lib/carriers/mock-flights";
import { mockTrainAdapter } from "@/lib/carriers/mock-trains";
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
 * Adapters span all supported transport types (BUS / FLIGHT / TRAIN); a
 * search query can narrow the fan-out via `query.transport`.
 *
 * Future integrations can be toggled via env vars:
 *   - CARRIER_FLIXBUS_ENABLED=true
 *   - CARRIER_GUNSEL_API_KEY=...
 */
const ALL: CarrierAdapter[] = [
  asolCarrierAdapter,
  mockCarrierAdapter,
  mockFlightAdapter,
  mockTrainAdapter,
];

const DEMO_IDS = new Set(["mock", "mock-air", "mock-rail"]);

/**
 * Demo carriers (made-up buses, flights and trains) are for development and
 * tests only: on in development, off in production unless
 * ENABLE_DEMO_CARRIERS=1 (CI sets it for the smoke tests).
 */
export function demoCarriersEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === "production") return env.ENABLE_DEMO_CARRIERS === "1";
  return env.ENABLE_DEMO_CARRIERS !== "0";
}

function enabled(): CarrierAdapter[] {
  return demoCarriersEnabled() ? ALL : ALL.filter((c) => !DEMO_IDS.has(c.id));
}

export function listCarriers(): CarrierAdapter[] {
  return [...enabled()];
}

export function findCarrier(id: string): CarrierAdapter | undefined {
  return enabled().find((c) => c.id === id);
}

/** Adapters that only know HH:MM get full timestamps from the searched date. */
function withDates(trips: Awaited<ReturnType<CarrierAdapter["search"]>>, date?: string) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return trips;
  return trips.map((t) => {
    if (t.departureAt) return t;
    const dep = new Date(`${date}T${t.departure}:00.000Z`);
    if (Number.isNaN(dep.getTime())) return t;
    return {
      ...t,
      departureAt: dep.toISOString(),
      arrivalAt: new Date(dep.getTime() + t.durationMinutes * 60_000).toISOString(),
    };
  });
}

export async function searchAllCarriers(
  query: SearchQuery
): Promise<SearchResult[]> {
  const registry = enabled();
  const carriers = query.transport
    ? registry.filter((c) => c.transportType === query.transport)
    : registry;

  const settled = await Promise.allSettled(
    carriers.map(async (carrier) => {
      const trips = withDates(await carrier.search(query), query.date);
      return {
        carrierId: carrier.id,
        carrierName: carrier.name,
        trips,
      } satisfies SearchResult;
    })
  );

  return settled.map((outcome, index) => {
    const carrier = carriers[index];
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
