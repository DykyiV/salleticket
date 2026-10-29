import { describe, expect, it } from "vitest";
import { bearerToken, sessionTokenFrom } from "@/lib/auth/bearer";
import { wantsAppToken } from "@/lib/auth/session";
import { groupOrders } from "@/lib/tickets/myOrders";
import type { ETicket } from "@/lib/tickets/eTicket";

const h = (value?: string) => ({ get: (n: string) => (n.toLowerCase() === "authorization" ? (value ?? null) : null) });

describe("mobile app bearer token", () => {
  it("reads «Authorization: Bearer <jwt>»", () => {
    expect(bearerToken(h("Bearer aaa.bbb.ccc"))).toBe("aaa.bbb.ccc");
    expect(bearerToken(h("bearer   aaa.bbb.ccc  "))).toBe("aaa.bbb.ccc");
  });

  it("ignores other schemes and junk", () => {
    expect(bearerToken(h())).toBeNull();
    expect(bearerToken(h("Basic dXNlcjpwYXNz"))).toBeNull();
    expect(bearerToken(h("Bearer"))).toBeNull();
    expect(bearerToken(h("Bearer a b"))).toBeNull();
    expect(bearerToken(h("Bearer <script>"))).toBeNull();
  });

  it("prefers the site cookie, falls back to the app token", () => {
    expect(sessionTokenFrom("cookie.jwt", h("Bearer app.jwt"))).toBe("cookie.jwt");
    expect(sessionTokenFrom(undefined, h("Bearer app.jwt"))).toBe("app.jwt");
    expect(sessionTokenFrom("", h())).toBeNull();
  });

  it("only client «app» asks for a token in the body", () => {
    expect(wantsAppToken({ client: "app" })).toBe(true);
    expect(wantsAppToken({ client: "web" })).toBe(false);
    expect(wantsAppToken({})).toBe(false);
    expect(wantsAppToken(null)).toBe(false);
  });
});

function eTicket(reference: string, over: Partial<ETicket> & { departAt?: string | null } = {}): ETicket {
  const { departAt = "2026-11-10T07:00", ...rest } = over;
  return {
    reference,
    groupRef: null,
    status: "RESERVED",
    state: "due",
    firstName: "Olena",
    lastName: "Test",
    ageCategory: "ADULT",
    email: null,
    phone: "+380",
    price: 50,
    toPay: 50,
    issuedAt: "2026-10-01T10:00:00.000Z",
    tripKind: "ONE_WAY",
    openReturn: false,
    journeys: [
      {
        kind: "outbound",
        from: "Київ",
        to: "Берлін",
        departAt,
        arriveAt: null,
        boardAddress: null,
        boardMap: null,
        alightAddress: null,
        alightMap: null,
        seat: 1,
        freeSeating: false,
        bus: null,
        carrier: null,
        legs: [],
      },
    ],
    checkUrl: `https://example.test/check/${reference}`,
    ...rest,
  } as ETicket;
}

describe("«Мої квитки» orders", () => {
  it("groups passengers of one order and splits upcoming / past", () => {
    const { upcoming, past } = groupOrders(
      [
        eTicket("AB-2", { groupRef: "AB-1", state: "paid" }),
        eTicket("AB-1", { groupRef: "AB-1", state: "due" }),
        eTicket("AB-9", { departAt: "2026-09-01T07:00" }),
        eTicket("AB-5", { departAt: "2026-11-20T07:00", state: "cancelled" }),
      ],
      "2026-10-29"
    );
    expect(upcoming.map((o) => o.key)).toEqual(["AB-1"]);
    expect(upcoming[0].tickets.map((t) => t.reference)).toEqual(["AB-1", "AB-2"]);
    expect(upcoming[0].state).toBe("due");
    expect(upcoming[0].total).toBe(100);
    // A trip in the past and a cancelled future order both go to «past».
    expect(past.map((o) => o.key).sort()).toEqual(["AB-5", "AB-9"]);
  });

  it("orders upcoming soonest first and past latest first", () => {
    const { upcoming, past } = groupOrders(
      [
        eTicket("AB-30", { departAt: "2026-12-01T07:00" }),
        eTicket("AB-31", { departAt: "2026-11-01T07:00" }),
        eTicket("AB-10", { departAt: "2026-08-01T07:00" }),
        eTicket("AB-11", { departAt: "2026-09-01T07:00" }),
      ],
      "2026-10-29"
    );
    expect(upcoming.map((o) => o.key)).toEqual(["AB-31", "AB-30"]);
    expect(past.map((o) => o.key)).toEqual(["AB-11", "AB-10"]);
  });
});
