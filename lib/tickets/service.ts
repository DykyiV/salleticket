import type { Prisma, PrismaClient, Ticket, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  recordTicketHistory,
  type RequestMeta,
  type TicketHistorySource,
} from "@/lib/tickets/history";

export type UpdateTicketStatusOptions = {
  /** Audit trail origin. Defaults to "API". */
  source?: TicketHistorySource;
  /**
   * Custom label for the history action column. Defaults to "STATUS_CHANGE"
   * for real transitions and "STATUS_CONFIRMED" when newStatus matches the
   * current one (so the audit still captures who confirmed it).
   */
  action?: string;
  /** IP + User-Agent from the originating request. */
  request?: RequestMeta;
};

export type UpdateTicketStatusResult = {
  ticket: Ticket;
  oldStatus: TicketStatus;
  newStatus: TicketStatus;
  changed: boolean;
};

export class TicketNotFoundError extends Error {
  constructor(id: string) {
    super(`Ticket not found: ${id}`);
    this.name = "TicketNotFoundError";
  }
}

type DbLike = PrismaClient | Prisma.TransactionClient;

/**
 * Transition a ticket to a new status and append an audit row.
 *
 * Steps (always executed inside a single transaction):
 *   1. Read the current ticket (throws TicketNotFoundError if missing).
 *   2. Save the old status.
 *   3. Update ticket.status to the new value (no-op if it already matches).
 *   4. Append a TicketHistory row with { oldStatus, newStatus, changedBy,
 *      source, ipAddress, userAgent, changes: { status: { from, to } } }.
 *
 * Can be called with the top-level `prisma` client (opens its own
 * transaction) or re-used from an existing $transaction by passing `tx`.
 */
export async function updateTicketStatus(
  ticketId: string,
  newStatus: TicketStatus,
  userId: string | null,
  options: UpdateTicketStatusOptions = {},
  tx?: Prisma.TransactionClient
): Promise<UpdateTicketStatusResult> {
  const run = async (db: DbLike): Promise<UpdateTicketStatusResult> => {
    const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new TicketNotFoundError(ticketId);

    const oldStatus = ticket.status;
    const changed = oldStatus !== newStatus;

    const updated = changed
      ? await db.ticket.update({
          where: { id: ticketId },
          data: { status: newStatus },
        })
      : ticket;

    await recordTicketHistory(db, {
      ticketId,
      action:
        options.action ?? (changed ? "STATUS_CHANGE" : "STATUS_CONFIRMED"),
      oldStatus,
      newStatus,
      changes: changed
        ? { status: { from: oldStatus, to: newStatus } }
        : null,
      source: options.source ?? "API",
      changedBy: userId,
      request: options.request,
    });

    return { ticket: updated, oldStatus, newStatus, changed };
  };

  if (tx) return run(tx);
  return prisma.$transaction((t) => run(t));
}
