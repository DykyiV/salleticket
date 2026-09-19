import { describe, expect, it } from "vitest";
import {
  computeGridPrice,
  parseMonthMultipliers,
  parseTiers,
  type TariffGridConfig,
} from "@/lib/pricing/grid";

const baseConfig: TariffGridConfig = {
  capacity: 50,
  tiers: [
    { share: 0.5, price: 40 },
    { share: 0.25, price: 60 },
    { share: 0.25, price: 90 },
  ],
  monthMultipliers: { 1: 1.2, 10: 0.85 },
  earlyBirdDays: 60,
  earlyBirdPercent: 25,
  lastMinuteDays: 3,
  lastMinutePercent: 15,
  minPrice: 30,
  maxPrice: 150,
};

const departure = (iso: string) => new Date(iso);
const now = new Date("2026-09-18T00:00:00.000Z");

describe("computeGridPrice — tiers by sold share", () => {
  it("first 50% of seats get tier 1", () => {
    const r = computeGridPrice(baseConfig, {
      soldSeats: 0,
      departureTime: departure("2026-11-15T08:00:00.000Z"),
      now,
    });
    expect(r?.tierIndex).toBe(0);
    expect(r?.tierPrice).toBe(40);
    expect(r?.price).toBe(40);
  });

  it("crossing 50% moves to tier 2, crossing 75% to tier 3", () => {
    const at50 = computeGridPrice(baseConfig, {
      soldSeats: 25,
      departureTime: departure("2026-11-15T08:00:00.000Z"),
      now,
    });
    expect(at50?.tierIndex).toBe(1);
    expect(at50?.tierPrice).toBe(60);

    const at75 = computeGridPrice(baseConfig, {
      soldSeats: 38,
      departureTime: departure("2026-11-15T08:00:00.000Z"),
      now,
    });
    expect(at75?.tierIndex).toBe(2);
    expect(at75?.tierPrice).toBe(90);
  });
});

describe("computeGridPrice — month multipliers", () => {
  it("January stacks ×1.2 with the early-bird discount", () => {
    const jan = computeGridPrice(baseConfig, {
      soldSeats: 0,
      departureTime: departure("2027-01-15T08:00:00.000Z"),
      now,
    });
    // 119 days out → early-bird: 40 × 1.2 × 0.75 = 36
    expect(jan?.monthMultiplier).toBe(1.2);
    expect(jan?.phase).toBe("early_bird");
    expect(jan?.price).toBe(36);
  });

  it("October applies ×0.85 without time phases in between", () => {
    const oct = computeGridPrice(baseConfig, {
      soldSeats: 0,
      departureTime: departure("2026-10-10T08:00:00.000Z"),
      now,
    });
    // 22 days out: no early-bird (60), no last-minute (3) → 40 × 0.85
    expect(oct?.monthMultiplier).toBe(0.85);
    expect(oct?.price).toBe(34);
  });
});

describe("computeGridPrice — time phases", () => {
  it("early-bird −25% when 60+ days out", () => {
    const r = computeGridPrice(baseConfig, {
      soldSeats: 0,
      departureTime: departure("2026-12-15T08:00:00.000Z"),
      now,
    });
    expect(r?.phase).toBe("early_bird");
    expect(r?.price).toBe(30); // 40 × 0.75
  });

  it("last-minute +15% within 3 days", () => {
    const r = computeGridPrice(baseConfig, {
      soldSeats: 0,
      departureTime: departure("2026-09-20T08:00:00.000Z"),
      now,
    });
    expect(r?.phase).toBe("last_minute");
    expect(r?.price).toBe(46); // 40 × 1.15
  });
});

describe("computeGridPrice — clamps", () => {
  it("never exceeds maxPrice", () => {
    const r = computeGridPrice(baseConfig, {
      soldSeats: 45,
      departureTime: departure("2027-01-20T08:00:00.000Z"), // Jan ×1.2, early-bird −25%
      now,
    });
    // 90 × 1.2 × 0.75 = 81 — under max; craft a real clamp case:
    const clamped = computeGridPrice(
      { ...baseConfig, maxPrice: 50 },
      { soldSeats: 45, departureTime: departure("2026-09-20T08:00:00.000Z"), now }
    );
    // 90 × 1.15 = 103.5 → clamped to 50
    expect(clamped?.price).toBe(50);
  });

  it("never goes below minPrice", () => {
    const r = computeGridPrice(
      { ...baseConfig, minPrice: 35 },
      { soldSeats: 0, departureTime: departure("2026-10-10T08:00:00.000Z"), now }
    );
    // 40 × 0.85 = 34 → clamped to 35
    expect(r?.price).toBe(35);
  });
});

describe("parsers", () => {
  it("parseTiers filters invalid rows", () => {
    expect(parseTiers('[{"share":0.5,"price":40},{"share":"x"}]')).toEqual([
      { share: 0.5, price: 40 },
    ]);
    expect(parseTiers("broken")).toEqual([]);
  });

  it("parseMonthMultipliers keeps months 1–12 with positive multipliers", () => {
    expect(parseMonthMultipliers('{"1":1.2,"13":5,"10":0.85,"x":2}')).toEqual({
      1: 1.2,
      10: 0.85,
    });
  });
});
