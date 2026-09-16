import { NextResponse, type NextRequest } from "next/server";
import { TicketStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { requestMeta } from "@/lib/tickets/history";
import {
  TicketNotFoundError,
  updateTicketStatus,
} from "@/lib/tickets/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Allowed status transitions from the admin panel.
 * CANCELLED and REFUNDED are terminal — a ticket never leaves them.
 */
const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  RESERVED: ["PAID_ONLINE", "PAID_CASH", "CANCELLED"],
  PAID_ONLINE: ["REFUNDED", "CANCELLED"],
  PAID_CASH: ["REFUNDED", "CANCELLED"],
  CANCELLED: [],
  REFUNDED: [],
};

/**
 * PATCH /api/admin/tickets/[id] { "status": "PAID_ONLINE" }
 * Change a ticket's status (payment point / cancellation). The transition is
 * validated and recorded in the ticket history with the admin as actor.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;

  let body: { status?: string };
  try {
    body = (await req.json()) as { status?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const status = body.status;
  if (!status || !(status in TicketStatus)) {
    return NextResponse.json(
      {
        error: `Invalid status — expected one of ${Object.keys(TicketStatus).join(", ")}`,
      },
      { status: 400 }
    );
  }

  try {
    const current = await prisma.ticket.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!current) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const allowed = ALLOWED_TRANSITIONS[current.status];
    if (!allowed.includes(status as TicketStatus)) {
      return NextResponse.json(
        {
          error: `Transition ${current.status} → ${status} is not allowed`,
          allowed,
        },
        { status: 409 }
      );
    }

    const result = await updateTicketStatus(
      id,
      status as TicketStatus,
      guard.session.sub,
      { source: "ADMIN_PANEL", request: requestMeta(req) }
    );

    return NextResponse.json({
      ticket: result.ticket,
      oldStatus: result.oldStatus,
      newStatus: result.newStatus,
    });
  } catch (err) {
    if (err instanceof TicketNotFoundError) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
