import type { TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { grandesTourEnabled } from "@/lib/carriers/grandes-tour/client";
import { gtIsCancelled, gtOrderTicketStatuses, gtRefParts } from "@/lib/carriers/grandes-tour/pricing";
import { updateTicketStatus } from "@/lib/tickets/service";

const ACTIVE: TicketStatus[] = ["RESERVED", "AWAITING_PAYMENT", "PAID_ONLINE", "PAID_CASH"];
const SWEEP_EVERY_MS = 60_000;
let lastSweep = 0;

/**
 * A ticket cancelled in the carrier's system (Grandes Tour: their site or
 * office) is cancelled here too — the reverse of scheduleCarrierCancel.
 * With ticket ids: checks those tickets. Without: checks every active GT
 * ticket of a trip not yet a day in the past, at most once a minute.
 * A GT error skips that order until the next check. Returns how many
 * tickets were cancelled.
 */
export async function syncCarrierCancellations(ticketIds?: string[]): Promise<number> {
  if (!grandesTourEnabled()) return 0;
  if (!ticketIds) {
    if (Date.now() - lastSweep < SWEEP_EVERY_MS) return 0;
    lastSweep = Date.now();
  }
  const tickets = await prisma.ticket.findMany({
    where: {
      status: { in: ACTIVE },
      carrierRef: { startsWith: "GT:" },
      ...(ticketIds
        ? { id: { in: ticketIds } }
        : { trip: { departureTime: { gte: new Date(Date.now() - 86_400_000) } } }),
    },
    select: { id: true, carrierRef: true },
  });

  const byOrder = new Map<number, { id: string; gtTicketId: number }[]>();
  for (const t of tickets) {
    const ref = gtRefParts(t.carrierRef);
    if (ref) byOrder.set(ref.orderId, [...(byOrder.get(ref.orderId) ?? []), { id: t.id, gtTicketId: ref.ticketId }]);
  }
  const statuses = await Promise.all(
    [...byOrder.keys()].map((orderId) => gtOrderTicketStatuses(orderId).catch(() => null)),
  );

  let cancelled = 0;
  for (const [i, list] of [...byOrder.values()].entries()) {
    for (const t of list) {
      if (!gtIsCancelled(statuses[i]?.get(t.gtTicketId))) continue;
      try {
        await updateTicketStatus(t.id, "CANCELLED", null, {
          source: "SYSTEM",
          action: "CANCELLED_BY_CARRIER",
          carrierCancelled: true,
        });
        cancelled++;
      } catch {
        // Changed concurrently — checked again next time.
      }
    }
  }
  return cancelled;
}
