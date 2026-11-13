import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { signSession } from "@/lib/auth/jwt";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { clientIp } from "@/lib/security/rateLimit";
import { limitPublic } from "@/lib/security/publicLimit";

/** Per-IP limits must hold however the visitor fills X-Forwarded-For. */

const RULE = { limit: 2, windowMs: 60_000 };

async function clean() {
  await prisma.rateLimit.deleteMany({ where: { key: { startsWith: "test-public" } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@public-limit.test" } } });
}
beforeEach(clean);
afterAll(clean);

function request(headers: Record<string, string>) {
  return new NextRequest("https://kaufmann-reisen.de/api/search", { headers });
}

async function cookieFor(role: "CUSTOMER" | "AGENT") {
  const user = await prisma.user.create({ data: { email: `${role.toLowerCase()}@public-limit.test`, password: "x", role } });
  return `${SESSION_COOKIE}=${await signSession({ sub: user.id, email: user.email, role: user.role, v: user.sessionVersion })}`;
}

describe("clientIp", () => {
  it("takes the address our proxy saw, never what the visitor wrote", () => {
    // nginx: X-Real-IP = the connecting address; X-Forwarded-For gets it appended.
    expect(clientIp(request({ "x-real-ip": "198.51.100.7", "x-forwarded-for": "1.2.3.4, 198.51.100.7" }))).toBe("198.51.100.7");
    expect(clientIp(request({ "x-forwarded-for": "1.2.3.4, 5.6.7.8, 198.51.100.7" }))).toBe("198.51.100.7");
    expect(clientIp(request({ "x-forwarded-for": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(clientIp(request({}))).toBeNull();
  });
});

describe("limitPublic", () => {
  it("counts by the real address: a changing X-Forwarded-For does not help", async () => {
    const codes: number[] = [];
    for (let i = 1; i <= 4; i++) {
      const res = await limitPublic(
        request({ "x-real-ip": "198.51.100.7", "x-forwarded-for": `203.0.113.${i}, 198.51.100.7` }),
        "test-public",
        RULE,
      );
      codes.push(res?.status ?? 200);
    }
    expect(codes).toEqual([200, 200, 429, 429]);
    // Another visitor is not affected.
    expect(await limitPublic(request({ "x-real-ip": "198.51.100.8" }), "test-public", RULE)).toBeNull();
  });

  it("limits customers like guests, but not staff (an office shares one address)", async () => {
    const customer = await cookieFor("CUSTOMER");
    const agent = await cookieFor("AGENT");
    const statuses = async (cookie: string, ip: string) => {
      const out: number[] = [];
      for (let i = 0; i < 3; i++) out.push((await limitPublic(request({ "x-real-ip": ip, cookie }), "test-public", RULE))?.status ?? 200);
      return out;
    };
    expect(await statuses(customer, "198.51.100.20")).toEqual([200, 200, 429]);
    expect(await statuses(agent, "198.51.100.21")).toEqual([200, 200, 200]);
  });
});
