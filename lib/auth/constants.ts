import type { Role } from "@prisma/client";

export const SESSION_COOKIE = "asol_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/**
 * Role hierarchy: a user with a higher-ranked role can do anything a lower
 * role can. Used by hasRoleAtLeast() / requireRole().
 */
export const ROLE_RANK: Record<Role, number> = {
  USER: 1,
  AGENT: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

export function hasRoleAtLeast(userRole: Role, required: Role): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[required];
}
