import { describe, expect, it } from "vitest";
import { activePromo } from "@/lib/site/promoBanner";

describe("Black Friday banner", () => {
  it("shows only from 23 to 30 November", () => {
    expect(activePromo("2026-11-22")).toBeNull();
    expect(activePromo("2026-11-23")?.code).toBe("BF20");
    expect(activePromo("2026-11-30")?.code).toBe("BF20");
    expect(activePromo("2026-12-01")).toBeNull();
  });
});
