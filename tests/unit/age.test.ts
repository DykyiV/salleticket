import { describe, expect, it } from "vitest";
import { ageCategoryFor, ageOn, birthDateProblem, parseBirthDate } from "@/lib/age";
import { computePrice } from "@/lib/pricing";

const d = (s: string) => parseBirthDate(s)!;

describe("date of birth → fare category on the travel date", () => {
  const trip = d("2026-11-03");
  it("counts full years", () => {
    expect(ageOn(d("2000-11-03"), trip)).toBe(26);
    expect(ageOn(d("2000-11-04"), trip)).toBe(25);
  });
  it("maps ages to categories at the boundaries", () => {
    expect(ageCategoryFor(d("2022-01-01"), trip)).toBe("CHILD_0_4");
    expect(ageCategoryFor(d("2021-11-04"), trip)).toBe("CHILD_0_4");
    expect(ageCategoryFor(d("2021-11-03"), trip)).toBe("CHILD_5_12");
    expect(ageCategoryFor(d("2013-11-04"), trip)).toBe("CHILD_5_12");
    expect(ageCategoryFor(d("2013-11-03"), trip)).toBe("ADULT");
    expect(ageCategoryFor(d("1966-11-04"), trip)).toBe("ADULT");
    expect(ageCategoryFor(d("1966-11-03"), trip)).toBe("SENIOR_60");
  });
  it("rejects malformed and implausible dates", () => {
    expect(parseBirthDate("2020-02-30")).toBeNull();
    expect(parseBirthDate("03.11.2000")).toBeNull();
    expect(birthDateProblem(d("2999-01-01"))).not.toBeNull();
    expect(birthDateProblem(d("1850-01-01"))).not.toBeNull();
    expect(birthDateProblem(d("1990-06-15"))).toBeNull();
  });
});

describe("service fee", () => {
  it("is 0 by default and added on top when set", () => {
    expect(computePrice(50, "ADULT").total).toBe(50);
    const p = computePrice(50, "CHILD_5_12", null, 2);
    expect(p.finalPrice).toBe(40);
    expect(p.serviceFee).toBe(2);
    expect(p.total).toBe(42);
  });
});
