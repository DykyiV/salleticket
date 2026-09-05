import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import type { SessionPayload } from "@/lib/auth/jwt";

export type GuardResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; response: NextResponse };

/**
 * Route-handler guard. Usage:
 *
 *   const guard = await requireRole("ADMIN");
 *   if (!guard.ok) return guard.response;
 *   const session = guard.session;
 */
export async function requireRole(required?: Role): Promise<GuardResult> {
  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      ),
    };
  }
  if (required && !hasRoleAtLeast(session.role, required)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Forbidden: ${required} role required` },
        { status: 403 }
      ),
    };
  }
  return { ok: true, session };
}

export async function requireAuth(): Promise<GuardResult> {
  return requireRole();
}
