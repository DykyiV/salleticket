/**
 * Fine-grained access control for the /staff/** area, layered on top of the
 * role check middleware.ts already does (role >= AGENT to reach /staff/**
 * at all).
 *
 * ADMIN and SUPER_ADMIN always have full access — these flags exist purely
 * to let an admin selectively unlock specific staff capabilities for a
 * given AGENT account (default: none, granted individually via
 * /admin/agents), not to restrict admins.
 */

import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hasRoleAtLeast } from "@/lib/auth/constants";

export type StaffPermissionKey =
  | "canAccessStaffTickets"
  | "canAccessStaffTrips"
  | "canMarkPayments";

export async function hasStaffPermission(
  session: { sub: string; role: Role },
  key: StaffPermissionKey
): Promise<boolean> {
  if (hasRoleAtLeast(session.role, "ADMIN")) return true;
  if (session.role !== "AGENT") return false;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { [key]: true },
  });
  return Boolean(user?.[key]);
}
