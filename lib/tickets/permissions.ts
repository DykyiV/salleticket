import type { Role } from "@prisma/client";
import { ticketRights, type TicketRef } from "@/lib/auth/access";

export type TicketAccess = {
  isOwner: boolean;
  isStaff: boolean;
  /** May see the ticket and its comments. */
  canView: boolean;
  /** May add comments / edit passenger details. */
  canEdit: boolean;
};

/**
 * What the session user may do with a ticket: the passenger who booked it,
 * and staff whose reach covers the ticket (see lib/auth/access.ts) with the
 * matching grants from the role/permission table.
 */
export async function ticketAccess(
  session: { sub: string; role: Role },
  ticket: TicketRef
): Promise<TicketAccess> {
  const rights = await ticketRights(session, ticket);
  return {
    isOwner: rights.isOwner,
    isStaff: rights.isStaff,
    canView: rights.canView,
    canEdit: rights.isOwner || rights.canEdit,
  };
}
