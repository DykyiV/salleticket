import { PaymentStatus, TicketStatus, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordTicketHistory } from "@/lib/tickets/history";
import { updateTicketVersioned } from "@/lib/tickets/version";
import { notifyPaymentReceived } from "@/lib/notify";

/** Reconciliation runs against the top-level client (opens transactions). */
type Db = PrismaClient;

/**
 * Reconcile one ticket's latest pending payment:
 *  - funds arrived (sent + settle window passed) → PAID_ONLINE
 *  - 24 h deadline passed without payment → online discount expires,
 *    ticket returns to RESERVED at the full price.
 */
export async function reconcileTicketPayment(
  ticketId: string,
  db: Db = prisma
): Promise<void> {
  const payment = await db.payment.findFirst({
    where: {
      ticketId,
      status: { in: [PaymentStatus.PENDING, PaymentStatus.SENT] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!payment) return;

  const now = new Date();
  if (
    payment.status === PaymentStatus.SENT &&
    payment.settleAfter &&
    now >= payment.settleAfter
  ) {
    await db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.SETTLED },
      });
      const current = await tx.ticket.findUnique({
        where: { id: payment.ticketId },
      });
      if (!current) return;
      const ticket = await updateTicketVersioned(tx, current.id, current.version, {
        status: TicketStatus.PAID_ONLINE,
      });
      await recordTicketHistory(tx, {
        ticketId: ticket.id,
        action: "PAYMENT_SETTLED",
        oldStatus: TicketStatus.AWAITING_PAYMENT,
        newStatus: TicketStatus.PAID_ONLINE,
        source: "SYSTEM",
        changes: {
          status: { from: TicketStatus.AWAITING_PAYMENT, to: TicketStatus.PAID_ONLINE },
          payment: { from: payment.status, to: PaymentStatus.SETTLED },
        },
      });
      await recordTicketHistory(tx, {
        ticketId: ticket.id,
        action: "EMAIL_SENT",
        source: "SYSTEM",
        changes: { email: { from: null, to: "квиток надіслано" } },
      });
    });
    const booking = await db.booking.findFirst({
      where: { ticketId: payment.ticketId },
      select: { reference: true },
    });
    if (booking) {
      await notifyPaymentReceived(booking.reference, payment.amount);
    }
    return;
  }

  if (now >= payment.deadlineAt) {
    await db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.EXPIRED },
      });
      const ticket = await tx.ticket.findUnique({
        where: { id: payment.ticketId },
      });
      if (ticket && ticket.status === TicketStatus.AWAITING_PAYMENT) {
        await updateTicketVersioned(tx, ticket.id, ticket.version, {
          status: TicketStatus.RESERVED,
          finalPrice: payment.fullAmount,
        });
        await tx.booking.updateMany({
          where: { ticketId: ticket.id },
          data: { finalPrice: payment.fullAmount },
        });
        await recordTicketHistory(tx, {
          ticketId: ticket.id,
          action: "PAYMENT_EXPIRED",
          oldStatus: TicketStatus.AWAITING_PAYMENT,
          newStatus: TicketStatus.RESERVED,
          source: "SYSTEM",
          changes: {
            status: { from: TicketStatus.AWAITING_PAYMENT, to: TicketStatus.RESERVED },
            finalPrice: { from: ticket.finalPrice, to: payment.fullAmount },
          },
        });
      }
    });
  }
}

/** Sweep all due payments (called on list pages so statuses stay fresh). */
export async function reconcileDuePayments(db: Db = prisma): Promise<void> {
  const now = new Date();
  const due = await db.payment.findMany({
    where: {
      OR: [
        { status: PaymentStatus.SENT, settleAfter: { lte: now } },
        { status: { in: [PaymentStatus.PENDING, PaymentStatus.SENT] }, deadlineAt: { lte: now } },
      ],
    },
    select: { ticketId: true },
  });
  for (const row of due) {
    await reconcileTicketPayment(row.ticketId, db);
  }
}
