import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { RESET_TTL_MS, ResetTokenError, issuePasswordReset, resetPasswordWithToken } from "@/lib/auth/passwordReset";

const EMAIL = "reset-user@test.local";

async function makeUser() {
  return prisma.user.create({ data: { email: EMAIL, password: await hashPassword("old-password"), passwordSet: false } });
}

describe("«Забули пароль?» links", () => {
  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
  });

  it("sets the new password once, signs out other sessions, stores only a hash", async () => {
    const user = await makeUser();
    const token = await issuePasswordReset(user.id);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.passwordResetHash).not.toBe(token);

    const updated = await resetPasswordWithToken(token, "new-password-1");
    expect(await verifyPassword("new-password-1", updated.password)).toBe(true);
    expect(updated.passwordSet).toBe(true);
    expect(updated.sessionVersion).toBe(user.sessionVersion + 1);
    expect(updated.passwordResetHash).toBeNull();

    await expect(resetPasswordWithToken(token, "another-password")).rejects.toBeInstanceOf(ResetTokenError);
  });

  it("refuses an expired, replaced or made-up link", async () => {
    const user = await makeUser();
    const first = await issuePasswordReset(user.id, new Date(Date.now() - RESET_TTL_MS - 1000));
    await expect(resetPasswordWithToken(first, "new-password-1")).rejects.toBeInstanceOf(ResetTokenError);

    await issuePasswordReset(user.id);
    await expect(resetPasswordWithToken(first, "new-password-1")).rejects.toBeInstanceOf(ResetTokenError);
    await expect(resetPasswordWithToken("made-up", "new-password-1")).rejects.toBeInstanceOf(ResetTokenError);
    await expect(resetPasswordWithToken("", "new-password-1")).rejects.toBeInstanceOf(ResetTokenError);

    const still = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword("old-password", still.password)).toBe(true);
  });
});
