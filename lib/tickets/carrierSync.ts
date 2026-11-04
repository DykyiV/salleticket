import { after } from "next/server";
import { prisma } from "@/lib/db";
import { gtCancelTicket, gtTicketIdFromRef } from "@/lib/carriers/grandes-tour/pricing";
import { grandesTourEnabled } from "@/lib/carriers/grandes-tour/client";
import { recordTicketHistory } from "@/lib/tickets/history";
import { notifyStaff } from "@/lib/notify";

/**
 * A ticket cancelled here is cancelled in the carrier's system too
 * (Grandes Tour), so the seat is freed for their sales as well. Runs after
 * the response (outside the DB transaction); a failure is logged in the
 * ticket history and staff are notified to cancel it there by hand.
 */
export function scheduleCarrierCancel(ticketId: string, carrierRef: string | null | undefined): void {
  if (!carrierRef || !gtTicketIdFromRef(carrierRef) || !grandesTourEnabled()) return;
  const run = async () => {
    try {
      await gtCancelTicket(carrierRef);
      await recordTicketHistory(prisma, {
        ticketId,
        action: "CARRIER_CANCELLED",
        source: "SYSTEM",
        changes: { carrierRef: { from: carrierRef, to: "cancelled" } },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await recordTicketHistory(prisma, {
        ticketId,
        action: "CARRIER_CANCEL_FAILED",
        source: "SYSTEM",
        changes: { carrierRef: { from: carrierRef, to: message } },
      }).catch(() => undefined);
      const booking = await prisma.booking.findFirst({ where: { ticketId }, select: { reference: true } });
      await notifyStaff({
        kind: "carrier_sync_failed",
        title: `Скасуйте квиток у Grandes Tour вручну: ${booking?.reference ?? ticketId}`,
        body: `${carrierRef} — ${message}`,
        link: booking ? `/admin/bookings/${booking.reference}` : undefined,
      }).catch(() => undefined);
    }
  };
  try {
    after(run);
  } catch {
    void run();
  }
}
