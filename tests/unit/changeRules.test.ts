import { describe, expect, it } from "vitest";
import { tripChangeRefusal } from "@/lib/tickets/changeRules";

const departure = new Date("2026-11-10T14:00:00.000Z");
const at = (iso: string) => new Date(iso);

describe("who may change a ticket's date or seat", () => {
  it("dispatchers and managers until the day of departure", () => {
    for (const role of ["DISPATCHER", "MANAGER"] as const) {
      expect(tripChangeRefusal(role, departure, at("2026-11-09T12:00:00Z"))).toBeNull();
      expect(tripChangeRefusal(role, departure, at("2026-11-10T20:00:00Z"))).toBeNull();
      expect(tripChangeRefusal(role, departure, at("2026-11-11T08:00:00Z"))).not.toBeNull();
    }
  });

  it("admins any time, passengers and other staff never", () => {
    expect(tripChangeRefusal("ADMIN", departure, at("2026-12-01T08:00:00Z"))).toBeNull();
    expect(tripChangeRefusal("SUPER_ADMIN", departure, at("2026-12-01T08:00:00Z"))).toBeNull();
    for (const role of ["CUSTOMER", "AGENT", "CALL_CENTER", "ACCOUNTANT", "DRIVER"] as const) {
      expect(tripChangeRefusal(role, departure, at("2026-11-01T08:00:00Z"))).not.toBeNull();
    }
  });
});
