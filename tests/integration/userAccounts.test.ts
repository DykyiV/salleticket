import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import {
  EmailTakenError,
  createUserWithTemporaryPassword,
  resetToTemporaryPassword,
  temporaryPassword,
} from "@/lib/auth/userAccounts";

const EMAIL = "staff-new@test.local";

describe("users added by an admin (temporary passwords)", () => {
  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: "staff-" } } });
  });

  it("temporary passwords are 12 characters without look-alikes", () => {
    const a = temporaryPassword();
    expect(a).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{12}$/);
    expect(temporaryPassword()).not.toBe(a);
  });

  it("creates the user with the role and a password that works", async () => {
    const { id, password } = await createUserWithTemporaryPassword(EMAIL, "MANAGER");
    const user = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(user.role).toBe("MANAGER");
    expect(user.passwordSet).toBe(false);
    expect(await verifyPassword(password, user.password)).toBe(true);
    await expect(createUserWithTemporaryPassword(EMAIL, "AGENT")).rejects.toBeInstanceOf(EmailTakenError);
  });

  it("a new password replaces the old one and signs the user out", async () => {
    const { id, password: old } = await createUserWithTemporaryPassword(EMAIL, "AGENT");
    const before = await prisma.user.findUniqueOrThrow({ where: { id } });
    const { password } = await resetToTemporaryPassword(id);
    const after = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(await verifyPassword(password, after.password)).toBe(true);
    expect(await verifyPassword(old, after.password)).toBe(false);
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);
    expect(after.passwordSet).toBe(false);
  });
});
