import { createHash, randomBytes } from "node:crypto";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

/** How long the link from the e-mail works. */
export const RESET_TTL_MS = 60 * 60_000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * A one-time token for «Забули пароль?» (replaces an earlier one). Only its
 * hash is stored; the raw token goes into the e-mail link.
 */
export async function issuePasswordReset(userId: string, now = new Date()): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.user.update({
    where: { id: userId },
    data: { passwordResetHash: hashToken(token), passwordResetExpires: new Date(now.getTime() + RESET_TTL_MS) },
  });
  return token;
}

export class ResetTokenError extends Error {
  constructor() {
    super("Reset link is invalid or expired");
    this.name = "ResetTokenError";
  }
}

/**
 * Sets the new password when the token is valid and not expired. The token is
 * used up and the user's other sessions end. Returns the updated user.
 */
export async function resetPasswordWithToken(token: string, newPassword: string, now = new Date()): Promise<User> {
  const hash = token ? hashToken(token) : "";
  const user = hash ? await prisma.user.findUnique({ where: { passwordResetHash: hash } }) : null;
  if (!user || !user.passwordResetExpires || user.passwordResetExpires <= now) throw new ResetTokenError();
  const used = await prisma.user.updateMany({
    where: { id: user.id, passwordResetHash: hash },
    data: {
      password: await hashPassword(newPassword),
      passwordSet: true,
      passwordResetHash: null,
      passwordResetExpires: null,
      sessionVersion: { increment: 1 },
    },
  });
  if (used.count !== 1) throw new ResetTokenError();
  return prisma.user.findUniqueOrThrow({ where: { id: user.id } });
}
