import { prisma } from "@/lib/db";
import { verifySession, type SessionPayload } from "@/lib/auth/jwt";

/**
 * A session token is only a pointer: the role and e-mail are always taken
 * from the database, and the token is rejected when
 *   - the user no longer exists, or
 *   - User.sessionVersion moved on since it was issued (logout, password or
 *     e-mail change, role change) — so a demoted or removed employee loses
 *     access on their very next request, on every device.
 * If the database is unreachable the session is treated as absent (fail
 * closed), never as the token's claims.
 */
export async function resolveSession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const claims = await verifySession(token);
  if (!claims) return null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { email: true, role: true, sessionVersion: true },
    });
    if (!user || user.sessionVersion !== (claims.v ?? 0)) return null;
    return { ...claims, email: user.email, role: user.role, v: user.sessionVersion };
  } catch {
    return null;
  }
}

/** Invalidate every session of a user (all devices). */
export async function revokeSessions(userId: string): Promise<number> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  return updated.sessionVersion;
}
