import { PaymentStatus, TicketStatus, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordTicketHistory } from "@/lib/tickets/history";
import { updateTicketVersioned } from "@/lib/tickets/version";
import { notifyPaymentReceived, notifySeatFreed } from "@/lib/notify";
import { notifyPassenger } from "@/lib/tickets/passengerNotify";
import { applyOnlineDiscount, getSiteSettings } from "@/lib/settings";

/** Reconciliation runs against the top-level client (opens transactions). */
type Db = PrismaClient;

/**
 * Reconcile one ticket's latest pending payment:
 *  - funds arrived (sent + settle window passed) → PAID_ONLINE
 *  - the pay-before deadline (24 h by default) passed and the passenger
 *    never paid → the booking is CANCELLED, the seat freed, and the
 *    passenger told by SMS and e-mail.
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

  // Still unpaid after the deadline. A payment already sent to the payment
  // system (SENT) waits for its settlement instead.
  if (payment.status === PaymentStatus.PENDING && now >= payment.deadlineAt) {
    let cancelled: { reference: string | null; seat: number | null } | null = null;
    await db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.EXPIRED },
      });
      const ticket = await tx.ticket.findUnique({
        where: { id: payment.ticketId },
        include: { booking: { select: { reference: true } } },
      });
      if (ticket && ticket.status === TicketStatus.AWAITING_PAYMENT) {
        await updateTicketVersioned(tx, ticket.id, ticket.version, {
          status: TicketStatus.CANCELLED,
        });
        await recordTicketHistory(tx, {
          ticketId: ticket.id,
          action: "PAYMENT_EXPIRED",
          oldStatus: TicketStatus.AWAITING_PAYMENT,
          newStatus: TicketStatus.CANCELLED,
          source: "SYSTEM",
          changes: {
            status: { from: TicketStatus.AWAITING_PAYMENT, to: TicketStatus.CANCELLED },
            payment: { from: payment.status, to: PaymentStatus.EXPIRED },
          },
        });
        cancelled = { reference: ticket.booking?.reference ?? null, seat: ticket.seatNumber };
      }
    });
    const done = cancelled as { reference: string | null; seat: number | null } | null;
    if (done?.reference) {
      await notifyPassenger(payment.ticketId, {
        sms: `Asol BUS: час на оплату квитка ${done.reference} минув, бронювання скасовано.`,
        subject: `Бронювання ${done.reference} скасовано`,
        text: `Оплата за квиток ${done.reference} не надійшла вчасно, тому бронювання автоматично скасовано, а місце звільнено. Ви можете оформити новий квиток на сайті.`,
      });
      await notifySeatFreed(done.reference, done.seat);
    }
  }
}

export class StartPaymentError extends Error {}

/**
 * The passenger (or staff) presses "Оплатити онлайн" on a reserved ticket:
 * the online discount applies, the ticket waits for the money
 * (AWAITING_PAYMENT) and has `paymentDeadlineHours` to be paid — otherwise
 * the booking is cancelled automatically.
 */
export async function startOnlinePayment(
  ticketId: string,
  actorId: string,
  db: Db = prisma
) {
  const settings = await getSiteSettings(db);
  return db.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new StartPaymentError("Квиток не знайдено");
    if (ticket.status !== TicketStatus.RESERVED) {
      throw new StartPaymentError("Онлайн-оплату можна почати лише для заброньованого квитка");
    }
    const amount = applyOnlineDiscount(ticket.finalPrice, settings);
    const deadlineAt = new Date(Date.now() + settings.paymentDeadlineHours * 3_600_000);
    const payment = await tx.payment.create({
      data: { ticketId, amount, fullAmount: ticket.finalPrice, deadlineAt },
    });
    await updateTicketVersioned(tx, ticket.id, ticket.version, {
      status: TicketStatus.AWAITING_PAYMENT,
      finalPrice: amount,
    });
    await tx.booking.updateMany({ where: { ticketId }, data: { finalPrice: amount } });
    await recordTicketHistory(tx, {
      ticketId,
      action: "PAYMENT_STARTED",
      oldStatus: TicketStatus.RESERVED,
      newStatus: TicketStatus.AWAITING_PAYMENT,
      source: "ACCOUNT",
      changedBy: actorId,
      changes: {
        status: { from: TicketStatus.RESERVED, to: TicketStatus.AWAITING_PAYMENT },
        finalPrice: { from: ticket.finalPrice, to: amount },
        deadlineAt: { from: null, to: deadlineAt },
      },
    });
    return payment;
  });
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
