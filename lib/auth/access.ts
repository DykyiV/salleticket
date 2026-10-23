import type { Prisma, Role } from "@prisma/client";
import { can } from "@/lib/auth/permissions";

/**
 * Who sees which tickets.
 *
 * Two independent questions decide every staff action on a ticket:
 *
 *  1. Permission — may this role do the action at all? Comes from the
 *     editable role/permission table in Settings (`can()`), so switching a
 *     box off there really switches the action off everywhere.
 *  2. Reach — whose tickets does the role work with? Fixed per role:
 *     office roles work with every ticket of the company, sales agents and
 *     partners only with the tickets they sold themselves (booked under their
 *     account) or took the passenger's cash for.
 *
 * The passenger who owns a ticket always keeps their own passenger rights,
 * whatever the table says.
 */
export const COMPANY_WIDE_ROLES: readonly Role[] = [
  "DISPATCHER",
  "CALL_CENTER",
  "ACCOUNTANT",
  "MANAGER",
  "ADMIN",
  "SUPER_ADMIN",
];

export type TicketRef = { userId: string; cashCollectedById?: string | null };
type Who = { sub: string; role: Role };

export function reachesAllTickets(role: Role): boolean {
  return COMPANY_WIDE_ROLES.includes(role);
}

/** The ticket is inside the role's working area (ignores permissions). */
export function ticketInReach(who: Who, ticket: TicketRef): boolean {
  if (who.role === "CUSTOMER") return false;
  return (
    reachesAllTickets(who.role) ||
    ticket.userId === who.sub ||
    (ticket.cashCollectedById ?? null) === who.sub
  );
}

export type TicketRights = {
  isOwner: boolean;
  /** Works with this ticket as staff (booking.read + reach). */
  isStaff: boolean;
  canView: boolean;
  /** Staff rights from the permission table; all false for non-staff. */
  canEdit: boolean;
  canCancel: boolean;
  canRefund: boolean;
  canEditPassenger: boolean;
};

export async function ticketRights(who: Who, ticket: TicketRef): Promise<TicketRights> {
  const isOwner = ticket.userId === who.sub;
  const reach = ticketInReach(who, ticket);
  const [read, edit, cancel, refund, passenger] = reach
    ? await Promise.all([
        can(who, "booking.read"),
        can(who, "booking.edit"),
        can(who, "booking.cancel"),
        can(who, "payment.refund"),
        can(who, "passenger.edit"),
      ])
    : [false, false, false, false, false];
  const isStaff = reach && read;
  return {
    isOwner,
    isStaff,
    canView: isOwner || isStaff,
    canEdit: isStaff && edit,
    canCancel: isStaff && cancel,
    canRefund: isStaff && refund,
    canEditPassenger: isStaff && passenger,
  };
}

/** Works with tickets as staff at all (any reach). */
export async function isTicketStaff(who: { role: Role }): Promise<boolean> {
  return who.role !== "CUSTOMER" && (await can(who, "booking.read"));
}

/** Prisma filter for the tickets this user may list. */
export async function ticketListWhere(who: Who): Promise<Prisma.TicketWhereInput> {
  if (!(await isTicketStaff(who))) return { userId: who.sub };
  if (reachesAllTickets(who.role)) return {};
  return { OR: [{ userId: who.sub }, { cashCollectedById: who.sub }] };
}
