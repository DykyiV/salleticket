import { describe, expect, it } from "vitest";
import { computePrice } from "@/lib/pricing";
import { applyOnlineDiscount, DEFAULT_SITE_SETTINGS } from "@/lib/settings";
import { parseTripKind } from "@/lib/tickets/kinds";
import { cityNames } from "@/lib/trips/cities";
import type { Promo } from "@/lib/promo";

function promo(partial: Partial<Promo>): Promo {
  return {
    id: "p1",
    code: "TEST",
    type: "PERCENT",
    percent: 0.1,
    amount: null,
    label: null,
    isActive: true,
    startsAt: null,
    endsAt: null,
    usageLimit: null,
    usedCount: 0,
    userId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as Promo;
}

describe("computePrice", () => {
  it("adult pays full price plus service fee", () => {
    const p = computePrice(100, "ADULT", null);
    expect(p.basePrice).toBe(100);
    expect(p.ageDiscount).toBe(0);
    expect(p.finalPrice).toBe(100);
    expect(p.total).toBe(101.5);
  });

  it("applies age discounts", () => {
    expect(computePrice(100, "CHILD_0_4", null).finalPrice).toBe(70);
    expect(computePrice(100, "CHILD_5_12", null).finalPrice).toBe(80);
    expect(computePrice(100, "SENIOR_60", null).finalPrice).toBe(90);
  });

  it("stacks promo on top of age discount", () => {
    const p = computePrice(100, "CHILD_5_12", null);
    expect(p.finalPrice).toBe(80);
    const withPromo = computePrice(99, "CHILD_5_12", promo({ percent: 0.1 }));
    expect(withPromo.finalPrice).toBe(71.28);
  });

  it("supports fixed-amount promos", () => {
    const p = computePrice(
      100,
      "ADULT",
      promo({ type: "FIXED", amount: 5, percent: 0 })
    );
    expect(p.finalPrice).toBe(95);
  });
});

describe("applyOnlineDiscount", () => {
  it("takes the configured percent off", () => {
    expect(applyOnlineDiscount(100, DEFAULT_SITE_SETTINGS)).toBe(95);
    expect(
      applyOnlineDiscount(100, {
        ...DEFAULT_SITE_SETTINGS,
        onlineDiscountPercent: 0,
      })
    ).toBe(100);
    expect(
      applyOnlineDiscount(94.05, {
        ...DEFAULT_SITE_SETTINGS,
        onlineDiscountPercent: 5,
      })
    ).toBe(89.35);
  });

  it("never goes negative or above 100%", () => {
    expect(
      applyOnlineDiscount(100, {
        ...DEFAULT_SITE_SETTINGS,
        onlineDiscountPercent: 150,
      })
    ).toBe(0);
  });
});

describe("parseTripKind", () => {
  it("defaults to ONE_WAY for unknown values", () => {
    expect(parseTripKind(undefined)).toBe("ONE_WAY");
    expect(parseTripKind("nonsense")).toBe("ONE_WAY");
    expect(parseTripKind("ROUND_TRIP")).toBe("ROUND_TRIP");
    expect(parseTripKind("OPEN_RETURN")).toBe("OPEN_RETURN");
  });
});

describe("cityNames", () => {
  it("maps Ukrainian and Latin spellings to the same group", () => {
    expect(cityNames("Київ")).toContain("Kyiv");
    expect(cityNames("Berlin")).toContain("Берлін");
    expect(cityNames("Марбелья")).toContain("Marbella");
  });

  it("returns the raw input for unknown cities", () => {
    expect(cityNames("Zhytomyr")).toEqual(["Zhytomyr"]);
  });
});
