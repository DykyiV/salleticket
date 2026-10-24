import { describe, expect, it } from "vitest";
import type { Trip } from "@/lib/mockTrips";
import {
  EMPTY_FILTERS,
  activeFilterCount,
  applyFilters,
  facets,
  filtersFromParams,
  periodOf,
  sortTrips,
  writeFiltersToParams,
} from "@/lib/results/filter";
import { demoCarriersEnabled } from "@/lib/carriers/registry";
import { commonFeatures, busFeaturesPatch, parseBusFeatures } from "@/lib/buses/features";

function trip(p: Partial<Trip>): Trip {
  return {
    id: p.id ?? "t",
    carrierId: "asol",
    carrier: "Grandes Tour",
    carrierShort: "GT",
    busType: "",
    transportType: "BUS",
    from: "Київ",
    to: "Берлін",
    departure: "08:00",
    arrival: "20:00",
    durationMinutes: 720,
    price: 50,
    currency: "EUR",
    seatsLeft: 20,
    amenities: [],
    rating: 0,
    ...p,
  };
}

const A = trip({ id: "a", departure: "07:00", arrival: "19:30", durationMinutes: 750, price: 40, seatsLeft: 5, busCategory: "COMFORT", features: ["wifi", "wc"], luggagePieces: 1 });
const B = trip({ id: "b", departure: "13:00", arrival: "05:00", durationMinutes: 960, price: 35, seatsLeft: 30, busCategory: "VIP", features: ["wifi", "wc", "water"], luggagePieces: 2, carrier: "Asol BUS", transfers: 1, transferCity: "Львів" });
const C = trip({ id: "c", departure: "22:30", arrival: "09:00", durationMinutes: 630, price: 60, seatsLeft: 12, busCategory: "STANDARD", features: ["ac"], luggagePieces: 1 });
const ALL = [A, B, C];

describe("results filters", () => {
  it("buckets times of day", () => {
    expect(periodOf("05:59")).toBe("night");
    expect(periodOf("06:00")).toBe("morning");
    expect(periodOf("12:00")).toBe("day");
    expect(periodOf("18:00")).toBe("evening");
  });

  it("offers only values present in the results", () => {
    const f = facets(ALL);
    expect(f.dep).toEqual(["morning", "day", "evening"]);
    expect(f.arr).toEqual(["night", "morning", "evening"]);
    expect(f.price).toEqual({ min: 35, max: 60 });
    expect(f.stops).toEqual(["direct", "transfer"]);
    expect(f.carriers).toEqual(["Asol BUS", "Grandes Tour"]);
    expect(f.features).toEqual(["wifi", "ac", "wc", "water"]);
    expect(f.luggage).toEqual([1, 2]);
  });

  it("combines filters (AND across groups, OR inside a group)", () => {
    expect(applyFilters(ALL, { ...EMPTY_FILTERS, dep: ["morning", "evening"] }).map((t) => t.id)).toEqual(["a", "c"]);
    expect(applyFilters(ALL, { ...EMPTY_FILTERS, stops: ["direct"] }).map((t) => t.id)).toEqual(["a", "c"]);
    expect(applyFilters(ALL, { ...EMPTY_FILTERS, features: ["wifi", "water"] }).map((t) => t.id)).toEqual(["b"]);
    expect(applyFilters(ALL, { ...EMPTY_FILTERS, maxPrice: 45, maxHours: 13 }).map((t) => t.id)).toEqual(["a"]);
    expect(applyFilters(ALL, { ...EMPTY_FILTERS, categories: ["VIP", "STANDARD"], minLuggage: 2 }).map((t) => t.id)).toEqual(["b"]);
    expect(applyFilters(ALL, { ...EMPTY_FILTERS, carriers: ["Grandes Tour"] }).map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("sorts by price, duration, departure and seats", () => {
    expect(sortTrips(ALL, "price").map((t) => t.id)).toEqual(["b", "a", "c"]);
    expect(sortTrips(ALL, "fastest").map((t) => t.id)).toEqual(["c", "a", "b"]);
    expect(sortTrips(ALL, "earliest").map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(sortTrips(ALL, "seats").map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("round-trips through the URL", () => {
    const f = { ...EMPTY_FILTERS, dep: ["night" as const], maxPrice: 45, features: ["wifi" as const], carriers: ["Asol BUS"] };
    const params = writeFiltersToParams(new URLSearchParams("from=Київ&to=Берлін"), f, "price");
    expect(params.get("from")).toBe("Київ");
    const back = filtersFromParams(Object.fromEntries(params));
    expect(back.sort).toBe("price");
    expect(back.filters).toEqual(f);
    expect(activeFilterCount(back.filters)).toBe(4);
    expect(filtersFromParams({ fdep: "nonsense", sort: "evil", fprice: "-3" })).toEqual({ sort: "earliest", filters: EMPTY_FILTERS });
  });
});

describe("demo carriers", () => {
  it("are off in production unless explicitly enabled", () => {
    expect(demoCarriersEnabled({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe(false);
    expect(demoCarriersEnabled({ NODE_ENV: "production", ENABLE_DEMO_CARRIERS: "1" } as NodeJS.ProcessEnv)).toBe(true);
    expect(demoCarriersEnabled({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe(true);
    expect(demoCarriersEnabled({ NODE_ENV: "development", ENABLE_DEMO_CARRIERS: "0" } as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe("bus features", () => {
  it("parses, validates and intersects", () => {
    expect(parseBusFeatures('["wc","wifi","bogus"]')).toEqual(["wifi", "wc"]);
    expect(parseBusFeatures("not json")).toEqual([]);
    expect(commonFeatures([["wifi", "wc"], ["wc", "ac"]])).toEqual(["wc"]);
    expect(busFeaturesPatch({ category: "VIP", amenities: ["wifi", "x"], luggagePieces: 2 })).toEqual({
      category: "VIP",
      amenities: '["wifi"]',
      luggagePieces: 2,
    });
    expect(() => busFeaturesPatch({ category: "LIMO" })).toThrow();
    expect(() => busFeaturesPatch({ luggagePieces: 9 })).toThrow();
  });
});
