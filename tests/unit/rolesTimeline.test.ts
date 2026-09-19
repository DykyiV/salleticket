import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
} from "@/lib/auth/permissions";
import { ROLE_RANK } from "@/lib/auth/constants";
import { buildTimeline, timelineLines } from "@/lib/tickets/timeline";

describe("role permissions", () => {
  it("every default grant is a known permission", () => {
    for (const permissions of Object.values(DEFAULT_ROLE_PERMISSIONS)) {
      for (const p of permissions) {
        expect(PERMISSIONS).toContain(p);
      }
    }
  });

  it("admins hold every permission; customers cannot refund or edit prices", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.ADMIN).toHaveLength(PERMISSIONS.length);
    expect(DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN).toHaveLength(PERMISSIONS.length);
    expect(DEFAULT_ROLE_PERMISSIONS.CUSTOMER).not.toContain("payment.refund");
    expect(DEFAULT_ROLE_PERMISSIONS.CUSTOMER).not.toContain("price.edit");
    expect(DEFAULT_ROLE_PERMISSIONS.CUSTOMER).toContain("booking.create");
  });

  it("managers can edit prices and refund; call-center cannot", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.MANAGER).toContain("price.edit");
    expect(DEFAULT_ROLE_PERMISSIONS.MANAGER).toContain("payment.refund");
    expect(DEFAULT_ROLE_PERMISSIONS.CALL_CENTER).not.toContain("payment.refund");
    expect(DEFAULT_ROLE_PERMISSIONS.CALL_CENTER).toContain("booking.edit");
  });

  it("role ranking keeps staff above customers", () => {
    expect(ROLE_RANK.MANAGER).toBeGreaterThan(ROLE_RANK.AGENT);
    expect(ROLE_RANK.AGENT).toBeGreaterThan(ROLE_RANK.CALL_CENTER);
    expect(ROLE_RANK.CUSTOMER).toBeLessThan(ROLE_RANK.PARTNER);
  });
});

describe("booking timeline", () => {
  it("renders «було → стало» lines with Ukrainian labels", () => {
    const lines = timelineLines(
      JSON.stringify({
        finalPrice: { from: 95, to: 85 },
        seatNumber: { from: 18, to: 21 },
      })
    );
    expect(lines).toContain("Ціна: було €95.00 → стало €85.00");
    expect(lines).toContain("Місце: було 18 → стало 21");
  });

  it("labels creations without a «було» part and resolves actors", () => {
    const entries = buildTimeline(
      [
        {
          id: "h1",
          timestamp: new Date("2026-09-18T16:32:00.000Z"),
          action: "CREATED",
          changes: JSON.stringify({ reference: { from: null, to: "AB-10001" } }),
          changedBy: "u1",
          source: "BOOKING_FORM",
        },
      ],
      new Map([["u1", "Менеджер Іван"]]),
      (action) => (action === "CREATED" ? "Створено бронювання" : action)
    );
    expect(entries[0].actor).toBe("Менеджер Іван");
    expect(entries[0].action).toBe("Створено бронювання");
    expect(entries[0].lines).toContain("Номер квитка: AB-10001");
  });

  it("handles broken JSON without crashing", () => {
    expect(timelineLines("not json")).toEqual([]);
    expect(timelineLines(null)).toEqual([]);
  });
});
