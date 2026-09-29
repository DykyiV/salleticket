import type { Role } from "@prisma/client";

export const SESSION_COOKIE = "asol_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/**
 * Role hierarchy: a user with a higher-ranked role can do anything a lower
 * role can. Used by hasRoleAtLeast() / requireRole().
 */
export const ROLE_RANK: Record<Role, number> = {
  CUSTOMER: 1,
  PARTNER: 2,
  DRIVER: 3,
  DISPATCHER: 4,
  CALL_CENTER: 5,
  ACCOUNTANT: 6,
  AGENT: 7,
  MANAGER: 8,
  ADMIN: 9,
  SUPER_ADMIN: 10,
};

export function hasRoleAtLeast(userRole: Role, required: Role): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[required];
}

export const ROLE_LABEL: Record<Role, string> = {
  CUSTOMER: "Клієнт",
  PARTNER: "Партнер",
  DRIVER: "Водій",
  DISPATCHER: "Диспетчер",
  CALL_CENTER: "Кол-центр",
  ACCOUNTANT: "Бухгалтер",
  AGENT: "Агент",
  MANAGER: "Менеджер",
  ADMIN: "Адміністратор",
  SUPER_ADMIN: "Супер-адмін",
};
