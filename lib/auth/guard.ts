import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import type { SessionPayload } from "@/lib/auth/jwt";
import { can, type Permission } from "@/lib/auth/permissions";

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

/**
 * Route-handler guard based on the editable role/permission matrix
 * (lib/auth/permissions.ts) instead of role rank — e.g. finance.read lets an
 * ACCOUNTANT in even though that role ranks below AGENT. Usage:
 *
 *   const guard = await requirePermission("finance.edit");
 *   if (!guard.ok) return guard.response;
 */
export async function requirePermission(permission: Permission): Promise<GuardResult> {
  const guard = await requireRole();
  if (!guard.ok) return guard;
  if (!(await can({ role: guard.session.role }, permission))) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Forbidden: ${permission} permission required` },
        { status: 403 }
      ),
    };
  }
  return guard;
}
