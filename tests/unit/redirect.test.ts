import { describe, expect, it } from "vitest";
import { homeAfterSignIn, safeNextPath } from "@/lib/security/redirect";

describe("safeNextPath", () => {
  it("keeps paths on this site, with query and hash", () => {
    expect(safeNextPath("/tickets/AB-12345")).toBe("/tickets/AB-12345");
    expect(safeNextPath("/cabinet/tickets?q=Олена&status=PAID#top")).toBe(
      "/cabinet/tickets?q=%D0%9E%D0%BB%D0%B5%D0%BD%D0%B0&status=PAID#top"
    );
    expect(safeNextPath("  /booking?tripId=1  ")).toBe("/booking?tripId=1");
    expect(safeNextPath("/a/../tickets")).toBe("/tickets");
  });

  it("drops other sites and tricks that browsers read as another host", () => {
    for (const bad of [
      "https://evil.example/login",
      "http:evil.example",
      "//evil.example",
      "///evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "/%5Cevil.example".replace("%5C", "\\"),
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html,hi",
      "/\tevil",
      "/\n/evil.example",
      "tickets",
      "",
      "   ",
      "/" + "a".repeat(600),
    ]) {
      expect(safeNextPath(bad), bad).toBeNull();
    }
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
  });

  it("does not loop back to the sign-in pages or into the API", () => {
    expect(safeNextPath("/login")).toBeNull();
    expect(safeNextPath("/login?next=/x")).toBeNull();
    expect(safeNextPath("/register")).toBeNull();
    expect(safeNextPath("/api/auth/logout")).toBeNull();
    expect(safeNextPath("/loginx")).toBe("/loginx");
  });

  it("sends passengers to their tickets and staff to the cabinet", () => {
    expect(homeAfterSignIn("CUSTOMER")).toBe("/tickets");
    expect(homeAfterSignIn(undefined)).toBe("/tickets");
    expect(homeAfterSignIn("AGENT")).toBe("/cabinet");
    expect(homeAfterSignIn("ADMIN")).toBe("/cabinet");
  });
});
