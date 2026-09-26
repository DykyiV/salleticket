import type { Role } from "@prisma/client";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { can } from "@/lib/auth/permissions";

export type TicketAccess = {
  isOwner: boolean;
  isStaff: boolean;
  /** May see the ticket and its comments. */
  canView: boolean;
  /** May add comments / edit passenger details. */
  canEdit: boolean;
};

/**
 * What the session user may do with a ticket owned by `ticketUserId`.
 *
 * Same audience as the rest of the cabinet: the passenger who booked it, and
 * staff (AGENT and above — who can already list every ticket). Editing by
 * staff additionally needs the `booking.edit` grant from the role/permission
 * matrix (/cabinet/settings), replacing main's per-user canViewAllTickets /
 * canEditAllTickets flags with the single permission system.
 */
export async function ticketAccess(
  session: { sub: string; role: Role },
  ticketUserId: string
): Promise<TicketAccess> {
  const isOwner = ticketUserId === session.sub;
  const isStaff = hasRoleAtLeast(session.role, "AGENT");
  const staffCanEdit = isStaff && (await can({ role: session.role }, "booking.edit"));
  return {
    isOwner,
    isStaff,
    canView: isOwner || isStaff,
    canEdit: isOwner || staffCanEdit,
  };
}
