import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { requestMeta } from "@/lib/tickets/history";
import { updateTicketStatus } from "@/lib/tickets/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/account/tickets/[id]/cancel
 * Cancel the caller's own ticket. Only RESERVED tickets can be cancelled by
 * their owner; paid tickets go through a refund flow by an admin.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;
  const { session } = guard;

  const { id } = await ctx.params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { userId: true, status: true },
  });
  if (!ticket || ticket.userId !== session.sub) {
    // Same response whether the ticket does not exist or belongs to someone
    // else — do not leak other users' ticket ids.
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  if (ticket.status !== "RESERVED") {
    return NextResponse.json(
      { error: "Only reserved (unpaid) tickets can be cancelled" },
      { status: 409 }
    );
  }

  const result = await updateTicketStatus(id, "CANCELLED", session.sub, {
    source: "ACCOUNT",
    action: "CANCELLED_BY_OWNER",
    request: requestMeta(req),
  });

  return NextResponse.json({
    ticket: result.ticket,
    oldStatus: result.oldStatus,
    newStatus: result.newStatus,
  });
}
