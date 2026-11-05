import { randomBytes } from "node:crypto";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

/** No look-alike characters (l/1/I, O/0), so it can be dictated by phone. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function temporaryPassword(length = 12): string {
  return Array.from(randomBytes(length), (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export class EmailTakenError extends Error {
  constructor(email: string) {
    super(`E-mail already registered: ${email}`);
    this.name = "EmailTakenError";
  }
}

/**
 * A user added by an admin. Mail is not connected, so the temporary password
 * goes back to the admin to pass on; passwordSet stays false, so after signing
 * in the user sets their own password in the profile.
 */
export async function createUserWithTemporaryPassword(
  email: string,
  role: Role
): Promise<{ id: string; password: string }> {
  const password = temporaryPassword();
  try {
    const user = await prisma.user.create({
      data: { email, role, password: await hashPassword(password), passwordSet: false },
      select: { id: true },
    });
    return { id: user.id, password };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new EmailTakenError(email);
    }
    throw err;
  }
}

/** A forgotten password replaced with a temporary one; signs the user out everywhere. */
export async function resetToTemporaryPassword(userId: string): Promise<{ password: string }> {
  const password = temporaryPassword();
  await prisma.user.update({
    where: { id: userId },
    data: { password: await hashPassword(password), passwordSet: false, sessionVersion: { increment: 1 } },
  });
  return { password };
}
