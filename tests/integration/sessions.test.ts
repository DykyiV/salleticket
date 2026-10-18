import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { signSession } from "@/lib/auth/jwt";
import { resolveSession, revokeSessions } from "@/lib/auth/resolve";

/** Sessions are checked against the database on every request. */

async function clean() {
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany({ where: { email: { endsWith: "@sessions.test" } } });
}
beforeEach(clean);
afterAll(clean);

async function staff(role: "AGENT" | "ADMIN" = "AGENT") {
  const user = await prisma.user.create({ data: { email: `${role.toLowerCase()}@sessions.test`, password: "x", role } });
  const token = await signSession({ sub: user.id, email: user.email, role: user.role, v: user.sessionVersion });
  return { user, token };
}

describe("resolveSession", () => {
  it("accepts a current token and takes the role from the database", async () => {
    const { user, token } = await staff("ADMIN");
    expect(await resolveSession(token)).toMatchObject({ sub: user.id, role: "ADMIN" });
    // Demoted without bumping the version: the role still follows the DB.
    await prisma.user.update({ where: { id: user.id }, data: { role: "CUSTOMER" } });
    expect((await resolveSession(token))?.role).toBe("CUSTOMER");
  });

  it("rejects the token once sessions are revoked (logout, password, role change)", async () => {
    const { user, token } = await staff();
    await revokeSessions(user.id);
    expect(await resolveSession(token)).toBeNull();
  });

  it("rejects the token of a deleted user and garbage tokens", async () => {
    const { user, token } = await staff();
    await prisma.user.delete({ where: { id: user.id } });
    expect(await resolveSession(token)).toBeNull();
    expect(await resolveSession("not-a-jwt")).toBeNull();
    expect(await resolveSession(undefined)).toBeNull();
  });
});
