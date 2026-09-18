import type { Role } from "@prisma/client";
import { hasRoleAtLeast } from "@/lib/auth/constants";

export type NavItem = {
  href: string;
  label: string;
  icon: "cabinet" | "tickets" | "departures" | "routes" | "settings" | "reports" | "stats" | "api";
  minRole: Role;
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
  { href: "/cabinet/stats", label: "Dashboard", icon: "stats", minRole: "AGENT" },
  { href: "/cabinet/api", label: "API", icon: "api", minRole: "AGENT" },
];

export function navForRole(role: Role): NavItem[] {
  return CABINET_NAV.filter((item) => hasRoleAtLeast(role, item.minRole));
}

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/cabinet") return pathname === "/cabinet";
  return pathname === href || pathname.startsWith(`${href}/`);
}
