import { hasRoleAtLeast } from "@/lib/auth/constants";
import type { SessionPayload } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db";

export type TicketPermissions = {
  isAdmin: boolean;
  isOwner: boolean;
  canViewAll: boolean;
  canEditAll: boolean;
  /** May see the ticket and its details (view rules). */
  canView: boolean;
  /** May edit passenger data / add comments (edit rules). */
  canEdit: boolean;
};

/**
 * Resolve what the session user may do with a ticket owned by `ticketUserId`.
 *
 * View: owner, users with the admin-granted `canViewAllTickets` flag, admins.
 * Edit: owner, users with the admin-granted `canEditAllTickets` flag, admins.
 * The permission flags are read from the DB (they are not in the JWT).
 */
export async function getTicketPermissions(
  session: SessionPayload,
  ticketUserId: string
): Promise<TicketPermissions> {
  const isAdmin = hasRoleAtLeast(session.role, "ADMIN");
  const isOwner = ticketUserId === session.sub;

  let canViewAll = false;
  let canEditAll = false;
  if (!isAdmin && !isOwner) {
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { canViewAllTickets: true, canEditAllTickets: true },
    });
    canViewAll = user?.canViewAllTickets ?? false;
    canEditAll = user?.canEditAllTickets ?? false;
  }

  return {
    isAdmin,
    isOwner,
    canViewAll,
    canEditAll,
    canView: isAdmin || isOwner || canViewAll,
    canEdit: isAdmin || isOwner || canEditAll,
  };
}
