import { NextResponse, type NextRequest } from "next/server";
import { TicketStatus, type PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { diffChanges, recordTicketHistory, requestMeta } from "@/lib/tickets/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAYMENT_METHODS: PaymentMethod[] = ["ONLINE", "CASH_TO_AGENT", "CASH_TO_CARRIER"];

/**
 * Records *who actually collected payment* for a ticket — separate from the
 * booking flow, since a RESERVED ticket booked online may later be paid in
 * cash to an agent, or at boarding to the carrier. Marking it also advances
 * the ticket to a PAID_* status if it's still RESERVED, so a single staff
 * action does both.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireRole("AGENT");
  if (!guard.ok) return guard.response;

  let body: { paymentMethod?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const paymentMethod = body.paymentMethod as PaymentMethod | undefined;
  if (!paymentMethod || !PAYMENT_METHODS.includes(paymentMethod)) {
    return NextResponse.json(
      { error: `paymentMethod must be one of ${PAYMENT_METHODS.join(", ")}` },
      { status: 400 }
    );
  }

  const meta = requestMeta(req);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUniqueOrThrow({ where: { id: params.id } });

      const nextStatus =
        ticket.status === TicketStatus.RESERVED
          ? paymentMethod === "ONLINE"
            ? TicketStatus.PAID_ONLINE
            : TicketStatus.PAID_CASH
          : ticket.status;

      const before = { paymentMethod: ticket.paymentMethod, status: ticket.status };
      const after = { paymentMethod, status: nextStatus };

      const next = await tx.ticket.update({
        where: { id: params.id },
        data: { paymentMethod, status: nextStatus },
      });

      await recordTicketHistory(tx, {
        ticketId: ticket.id,
        action: "PAYMENT_METHOD_SET",
        oldStatus: ticket.status,
        newStatus: nextStatus,
        source: "ADMIN_PANEL",
        changedBy: guard.session.sub,
        request: meta,
        changes: diffChanges(before, after),
      });

      return next;
    });

    return NextResponse.json({ ticket: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update ticket" },
      { status: 404 }
    );
  }
}
