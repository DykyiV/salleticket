/**
 * The three-status cancel/refund state machine:
 *
 *   RESERVED    -> CANCELLED   nothing was paid yet, no money moves.
 *                              Allowed for the ticket's own owner (always —
 *                              it's their unpaid booking) or staff with
 *                              canCancelTickets (ADMIN/SUPER_ADMIN always).
 *
 *   PAID_CASH   -> REFUNDED    cash refund: RefundPolicy.cashRefundPercent
 *                              (default 80%) goes back to the passenger in
 *                              cash; the rest is withheld by whoever
 *                              collected it (the agent, if paymentMethod
 *                              was CASH_TO_AGENT, or the carrier, if
 *                              CASH_TO_CARRIER). Staff-only (not
 *                              self-service — a real refund needs someone
 *                              to hand back real cash).
 *
 *   PAID_ONLINE -> REFUNDED    automatic refund via the payment gateway
 *                              (lib/payments/gateway.ts — mocked until a
 *                              real provider is wired in), for
 *                              RefundPolicy.onlineRefundPercent by default,
 *                              but the gateway's own response is
 *                              authoritative once a real one exists (it may
 *                              apply its own fees/rules). Staff-only.
 *
 * CANCELLED and REFUNDED are terminal — cancelling either again is rejected.
 */

import type { Role, Ticket } from "@prisma/client";
import { TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { hasStaffPermission } from "@/lib/auth/staffPermissions";
import { getRefundPolicy } from "@/lib/refundPolicy";
import { getPaymentGateway } from "@/lib/payments/gateway";
import { recordTicketHistory, type RequestMeta } from "@/lib/tickets/history";

export class CancelError extends Error {
  readonly status: number;
  readonly reason: string;
  constructor(reason: string, message: string, status: number) {
    super(message);
    this.name = "CancelError";
    this.reason = reason;
    this.status = status;
  }
}

export type CancelActor = { sub: string; role: Role };

export type CancelOutcome = {
  ticket: Ticket;
  refundAmount: number | null;
  refundWithheld: number | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function cancelTicket(
  ticketId: string,
  actor: CancelActor,
  request?: RequestMeta
): Promise<CancelOutcome> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new CancelError("not_found", "Ticket not found", 404);

  if (ticket.status === TicketStatus.CANCELLED || ticket.status === TicketStatus.REFUNDED) {
    throw new CancelError(
      "already_final",
      `Ticket is already ${ticket.status.toLowerCase()}`,
      409
    );
  }

  const isOwner = ticket.userId === actor.sub;
  const isAdmin = hasRoleAtLeast(actor.role, "ADMIN");
  const canStaffCancel = isAdmin || (await hasStaffPermission(actor, "canCancelTickets"));

  if (ticket.status === TicketStatus.RESERVED) {
    if (!isOwner && !canStaffCancel) {
      throw new CancelError(
        "forbidden",
        "You don't have permission to cancel this ticket",
        403
      );
    }
    return runCancellation(ticket, actor, request, {
      nextStatus: TicketStatus.CANCELLED,
      action: "CANCELLED",
      source: isOwner && !canStaffCancel ? "ACCOUNT" : "ADMIN_PANEL",
      refundAmount: null,
      refundWithheld: null,
    });
  }

  // PAID_CASH / PAID_ONLINE -> REFUNDED. Real money changing hands is
  // staff-only, never self-service, regardless of who owns the ticket.
  if (!canStaffCancel) {
    throw new CancelError(
      "forbidden",
      "Refunding a paid ticket requires staff permission (canCancelTickets)",
      403
    );
  }

  const policy = await getRefundPolicy(prisma);

  if (ticket.status === TicketStatus.PAID_CASH) {
    const refundAmount = round2(ticket.finalPrice * policy.cashRefundPercent);
    const refundWithheld = round2(ticket.finalPrice - refundAmount);
    return runCancellation(ticket, actor, request, {
      nextStatus: TicketStatus.REFUNDED,
      action: "REFUNDED_CASH",
      source: "ADMIN_PANEL",
      refundAmount,
      refundWithheld,
    });
  }

  // PAID_ONLINE
  const intendedAmount = round2(ticket.finalPrice * policy.onlineRefundPercent);
  const gateway = getPaymentGateway();
  const result = await gateway.refund({
    ticketId: ticket.id,
    amount: intendedAmount,
    currency: "EUR",
  });
  if (!result.success) {
    throw new CancelError(
      "gateway_failed",
      result.error ?? "The payment gateway declined the refund",
      502
    );
  }
  const refundAmount = round2(result.refundedAmount);
  const refundWithheld = round2(ticket.finalPrice - refundAmount);
  return runCancellation(ticket, actor, request, {
    nextStatus: TicketStatus.REFUNDED,
    action: "REFUNDED_ONLINE",
    source: "ADMIN_PANEL",
    refundAmount,
    refundWithheld,
  });
}

async function runCancellation(
  ticket: Ticket,
  actor: CancelActor,
  request: RequestMeta | undefined,
  args: {
    nextStatus: TicketStatus;
    action: string;
    source: "ACCOUNT" | "ADMIN_PANEL";
    refundAmount: number | null;
    refundWithheld: number | null;
  }
): Promise<CancelOutcome> {
  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        status: args.nextStatus,
        refundAmount: args.refundAmount,
        refundWithheld: args.refundWithheld,
        refundedAt: args.nextStatus === TicketStatus.REFUNDED ? new Date() : undefined,
        refundedByUserId:
          args.nextStatus === TicketStatus.REFUNDED && args.source === "ADMIN_PANEL"
            ? actor.sub
            : null,
      },
    });

    // Release the seat back into inventory, if this trip tracks real seats.
    await tx.seat.updateMany({
      where: { ticketId: ticket.id },
      data: { status: "AVAILABLE", ticketId: null },
    });

    await recordTicketHistory(tx, {
      ticketId: ticket.id,
      action: args.action,
      oldStatus: ticket.status,
      newStatus: args.nextStatus,
      source: args.source,
      changedBy: actor.sub,
      request,
      changes: {
        status: { from: ticket.status, to: args.nextStatus },
        refundAmount: { from: null, to: args.refundAmount },
        refundWithheld: { from: null, to: args.refundWithheld },
      },
    });

    return next;
  });

  return {
    ticket: updated,
    refundAmount: updated.refundAmount,
    refundWithheld: updated.refundWithheld,
  };
}
