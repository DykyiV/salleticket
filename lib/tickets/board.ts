import { prisma } from "@/lib/db";
import { recordTicketHistory } from "@/lib/tickets/history";

/** First driver check marks the passenger as boarded. Later checks keep the same time. */
export async function markPassengerBoarded(ticketId: string, actorId: string): Promise<Date | null> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { status: true, boardedAt: true },
  });
  if (!ticket) return null;
  if (ticket.status === "CANCELLED" || ticket.status === "REFUNDED") return null;
  if (ticket.boardedAt) return ticket.boardedAt;
  const boardedAt = new Date();
  await prisma.ticket.update({ where: { id: ticketId }, data: { boardedAt } });
  await recordTicketHistory(prisma, {
    ticketId,
    action: "BOARDED",
    oldStatus: ticket.status,
    newStatus: ticket.status,
    source: "AGENT_PANEL",
    changedBy: actorId,
    changes: { boardedAt: { from: null, to: boardedAt.toISOString() } },
  });
  return boardedAt;
}
