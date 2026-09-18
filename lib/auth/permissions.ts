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
  ACCOUNTANT: ["booking.read", "payment.read", "payment.refund", "price.read"],
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
 * Admins always pass. Everyone else follows the editable grants; when a role
 * has no rows yet (fresh DB), the built-in defaults apply.
 */
export async function can(
  user: { role: Role },
  permission: Permission,
  db: Db = prisma
): Promise<boolean> {
  if (isAdminRole(user.role)) return true;
  const granted = await rolePermissions(user.role, db);
  if (granted.size > 0) return granted.has(permission);
  return DEFAULT_ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
}
