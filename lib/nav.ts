import type { Role } from "@prisma/client";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import type { Permission } from "@/lib/auth/permissions";

export type NavItem = {
  href: string;
  label: string;
  icon:
    | "cabinet"
    | "tickets"
    | "departures"
    | "routes"
    | "settings"
    | "reports"
    | "stats"
    | "finance"
    | "api";
  minRole: Role;
  /**
   * When set, the item is shown by permission instead of role rank — e.g.
   * finance.read reaches ACCOUNTANT (ranked below AGENT) but not AGENT.
   * Resolved on the server (see NAV_PERMISSIONS) and passed to the sidebar.
   */
  permission?: Permission;
};

export const CABINET_NAV: NavItem[] = [
  { href: "/cabinet", label: "Мій кабінет", icon: "cabinet", minRole: "CUSTOMER" },
  { href: "/cabinet/tickets", label: "Квитки", icon: "tickets", minRole: "CUSTOMER" },
  { href: "/cabinet/departures", label: "Виїзди", icon: "departures", minRole: "AGENT" },
  { href: "/cabinet/buses", label: "Автобуси", icon: "departures", minRole: "ADMIN" },
  { href: "/cabinet/scan", label: "Сканер квитків", icon: "tickets", minRole: "DRIVER" },
  { href: "/cabinet/routes", label: "Маршрути шаблони", icon: "routes", minRole: "ADMIN" },
  { href: "/cabinet/settings", label: "Налаштування", icon: "settings", minRole: "ADMIN" },
  { href: "/cabinet/reports", label: "Звіти", icon: "reports", minRole: "ADMIN" },
  {
    href: "/cabinet/finance",
    label: "Фінанси",
    icon: "finance",
    minRole: "CUSTOMER",
    permission: "finance.read",
  },
  { href: "/cabinet/stats", label: "Dashboard", icon: "stats", minRole: "AGENT" },
  { href: "/cabinet/api", label: "API", icon: "api", minRole: "AGENT" },
];

/** Permissions that gate nav items — the layout resolves these per user. */
export const NAV_PERMISSIONS: Permission[] = [
  ...new Set(
    CABINET_NAV.flatMap((item) => (item.permission ? [item.permission] : []))
  ),
];

export function navForRole(role: Role, granted: readonly string[] = []): NavItem[] {
  return CABINET_NAV.filter((item) =>
    item.permission
      ? granted.includes(item.permission)
      : hasRoleAtLeast(role, item.minRole)
  );
}

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/cabinet") return pathname === "/cabinet";
  return pathname === href || pathname.startsWith(`${href}/`);
}
