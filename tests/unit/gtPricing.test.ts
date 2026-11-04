import { describe, expect, it } from "vitest";
import { gtKindForAge, gtKindForBirthDate, gtLegFromKey, gtTicketIdFromRef, gtTicketRef, gtTypeFor } from "@/lib/carriers/grandes-tour/pricing";
import { zoneFromCountries, zoneFromNames } from "@/lib/trips/baggage";

describe("Grandes Tour fare types", () => {
  it("maps ages to GT passenger kinds", () => {
    expect(gtKindForAge(0)).toBe("INFANT");
    expect(gtKindForAge(3)).toBe("INFANT");
    expect(gtKindForAge(4)).toBe("CHILD");
    expect(gtKindForAge(11)).toBe("CHILD");
    expect(gtKindForAge(12)).toBe("YOUTH");
    expect(gtKindForAge(24)).toBe("YOUTH");
    expect(gtKindForAge(25)).toBe("ADULT");
    expect(gtKindForAge(59)).toBe("ADULT");
    expect(gtKindForAge(60)).toBe("SENIOR");
    expect(gtKindForAge(null)).toBe("ADULT");
  });

  it("uses the age on the travel date", () => {
    const travel = new Date("2026-12-01T12:00:00Z");
    expect(gtKindForBirthDate("2022-12-02", travel)).toBe("INFANT");
    expect(gtKindForBirthDate("2022-12-01", travel)).toBe("CHILD");
    expect(gtKindForBirthDate("", travel)).toBe("ADULT");
  });

  it("picks the passenger type by its name", () => {
    const types = [
      { id: 52, name: "Дорослий", discount: 0 },
      { id: 53, name: "Дитина до 4 р.", discount: 30 },
      { id: 54, name: "Дитина 4-12 р.", discount: 20 },
      { id: 55, name: "Молодь 12-24", discount: 10 },
      { id: 56, name: "Пенсіонер від 60", discount: 10 },
      { id: 59, name: "УБД", discount: 10 },
    ];
    expect(gtTypeFor(types, "ADULT")?.id).toBe(52);
    expect(gtTypeFor(types, "INFANT")?.id).toBe(53);
    expect(gtTypeFor(types, "CHILD")?.id).toBe(54);
    expect(gtTypeFor(types, "YOUTH")?.id).toBe(55);
    expect(gtTypeFor(types, "SENIOR")?.id).toBe(56);
    expect(gtTypeFor([types[0]], "YOUTH")?.id).toBe(52);
  });

  it("parses trip keys and ticket refs", () => {
    expect(gtLegFromKey("gt-10-1-93")).toEqual({ tripId: 10, fromId: 1, toId: 93 });
    expect(gtLegFromKey("kaufmann-1")).toBeNull();
    expect(gtTicketIdFromRef(gtTicketRef(7, 99))).toBe(99);
    expect(gtTicketIdFromRef("GT:7:")).toBeNull();
  });
});

describe("baggage zones", () => {
  it("prefers Spain, then Germany", () => {
    expect(zoneFromCountries(["UA", "ES"])).toBe("ES");
    expect(zoneFromCountries(["DEU", "UA"])).toBe("DE");
    expect(zoneFromCountries(["UA", "PL"])).toBeNull();
    expect(zoneFromNames("Львів", "Мадрид")).toBe("ES");
    expect(zoneFromNames("Білефельд", "Київ")).toBe("DE");
  });
});
