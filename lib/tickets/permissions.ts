import type { Role } from "@prisma/client";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { can } from "@/lib/auth/permissions";

export type TicketAccess = {
  isOwner: boolean;
  isStaff: boolean;
  /** May see the ticket and its comments. */
  canView: boolean;
  /** Agent workspace: change passenger, seat, trip and comments. */
  canEdit: boolean;
};

/**
 * What the session user may do with a ticket owned by `ticketUserId`.
 *
 * The passenger who booked it, and staff from AGENT upward, may open the
 * ticket. Changing passenger data, the seat or the trip is the agent
 * workspace and needs `booking.edit`. A customer sees the same screen
 * read-only.
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
    canEdit: staffCanEdit,
  };
}
