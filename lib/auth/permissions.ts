import type { Prisma, PrismaClient, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isAdminRole } from "@/lib/routes/permissions";

export const PERMISSIONS = [
  "booking.read",
  "booking.create",
  "booking.edit",
  "booking.cancel",
  "passenger.read",
  "passenger.edit",
  "payment.read",
  "payment.refund",
  "price.read",
  "price.edit",
  "route.read",
  "route.edit",
  "finance.read",
  "finance.edit",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABEL: Record<Permission, string> = {
  "booking.read": "Квитки: перегляд",
  "booking.create": "Квитки: створення",
  "booking.edit": "Квитки: редагування",
  "booking.cancel": "Квитки: скасування",
  "passenger.read": "Пасажири: перегляд",
  "passenger.edit": "Пасажири: редагування",
  "payment.read": "Оплати: перегляд",
  "payment.refund": "Оплати: повернення",
  "price.read": "Ціни: перегляд",
  "price.edit": "Ціни: редагування",
  "route.read": "Маршрути: перегляд",
  "route.edit": "Маршрути: редагування",
  "finance.read": "Фінанси: звіти перевізників і розрахунки (перегляд)",
  "finance.edit": "Фінанси: комісії, формування і оплата розрахунків",
};

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  CUSTOMER: ["booking.read", "booking.create", "passenger.read", "passenger.edit"],
  PARTNER: ["booking.read", "booking.create", "passenger.read", "route.read"],
  DRIVER: ["route.read", "booking.read", "passenger.read"],
  DISPATCHER: ["route.read", "route.edit", "booking.read", "passenger.read"],
  CALL_CENTER: [
    "booking.read",
    "booking.create",
    "booking.edit",
    "passenger.read",
    "passenger.edit",
  ],
  ACCOUNTANT: [
    "booking.read",
    "payment.read",
    "payment.refund",
    "price.read",
    "finance.read",
    "finance.edit",
  ],
  AGENT: [
    "booking.read",
    "booking.create",
    "booking.edit",
    "booking.cancel",
    "passenger.read",
    "passenger.edit",
    "price.read",
    "route.read",
  ],
  MANAGER: [
    "booking.read",
    "booking.create",
    "booking.edit",
    "booking.cancel",
    "passenger.read",
    "passenger.edit",
    "payment.read",
    "payment.refund",
    "price.read",
    "price.edit",
    "route.read",
    "route.edit",
    "finance.read",
  ],
  ADMIN: [...PERMISSIONS],
  SUPER_ADMIN: [...PERMISSIONS],
};

type Db = PrismaClient | Prisma.TransactionClient;

/** Write the default grants for roles that have no rows yet. Idempotent. */
export async function seedRolePermissions(db: Db = prisma): Promise<void> {
  for (const [role, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS) as [
    Role,
    Permission[],
  ][]) {
    for (const permission of permissions) {
      await db.rolePermission.upsert({
        where: { role_permission: { role, permission } },
        create: { role, permission, allowed: true },
        update: {},
      });
    }
  }
}

export async function rolePermissions(
  role: Role,
  db: Db = prisma
): Promise<Set<Permission>> {
  const rows = await db.rolePermission.findMany({
    where: { role, allowed: true },
    select: { permission: true },
  });
  return new Set(rows.map((r) => r.permission as Permission));
}

/**
 * Admins always pass. Everyone else follows the editable grants: an explicit
 * row (allowed true OR false — the matrix never deletes rows, it flips
 * `allowed`) always wins. Only when there is no row for this role+permission
 * do the built-in defaults apply — on a fresh DB, and for permissions added
 * after the DB was seeded (e.g. finance.*), so existing installs get sane
 * defaults without a reseed while every admin decision is preserved.
 */
export async function can(
  user: { role: Role },
  permission: Permission,
  db: Db = prisma
): Promise<boolean> {
  if (isAdminRole(user.role)) return true;
  const row = await db.rolePermission.findUnique({
    where: { role_permission: { role: user.role, permission } },
    select: { allowed: true },
  });
  if (row) return row.allowed;
  return DEFAULT_ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
}
