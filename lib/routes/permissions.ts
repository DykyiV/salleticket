import type { Role } from "@prisma/client";

export type PermissionFlags = {
  role: Role;
  canEditDepartures: boolean;
  canHideStops: boolean;
  canHideSeats: boolean;
};

export function isAdminRole(role: Role): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function canEditDepartures(user: PermissionFlags): boolean {
  return isAdminRole(user.role) || (user.role === "AGENT" && user.canEditDepartures);
}

export function canHideStops(user: PermissionFlags): boolean {
  return isAdminRole(user.role) || (user.role === "AGENT" && user.canHideStops);
}

export function canHideSeats(user: PermissionFlags): boolean {
  return isAdminRole(user.role) || (user.role === "AGENT" && user.canHideSeats);
}

export function canManageTemplates(user: PermissionFlags): boolean {
  return isAdminRole(user.role);
}

export function departureCapabilities(user: PermissionFlags) {
  return {
    canEdit: canEditDepartures(user),
    canHideStops: canHideStops(user),
    canHideSeats: canHideSeats(user),
    canManageTemplates: canManageTemplates(user),
  };
}
