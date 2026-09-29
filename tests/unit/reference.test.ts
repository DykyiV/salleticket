import { describe, expect, it } from "vitest";
import { generateReference, REFERENCE_PATTERN } from "@/lib/tickets/reference";

describe("generateReference", () => {
  it("is two fixed letters, a hyphen and five digits", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateReference()).toMatch(REFERENCE_PATTERN);
    }
  });

  it("keeps the AB prefix and zero-pads the digits", () => {
    const ref = generateReference();
    expect(ref.startsWith("AB-")).toBe(true);
    expect(ref).toHaveLength(8);
  });
});
