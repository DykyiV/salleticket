import { NextResponse, type NextRequest } from "next/server";
import { Prisma, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import {
  recordTicketHistory,
  requestMeta,
  diffChanges,
} from "@/lib/tickets/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { reference: string } };

const ALLOWED_STATUSES = new Set<TicketStatus>([
  TicketStatus.RESERVED,
  TicketStatus.PAID_ONLINE,
  TicketStatus.PAID_CASH,
  TicketStatus.CANCELLED,
  TicketStatus.REFUNDED,
]);

/**
 * GET  /api/admin/bookings/[reference]         -> booking + ticket history
 * PATCH /api/admin/bookings/[reference]        -> admin changes status; full
 *                                                 audit trail is appended.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const booking = await prisma.booking.findUnique({
    where: { reference: params.reference },
    include: {
      ticket: {
        include: {
          history: { orderBy: { timestamp: "asc" } },
          trip: { include: { carrier: true } },
        },
      },
    },
  });

  if (!booking) {
    return NextResponse.json(
      { error: "Booking not found" },
      { status: 404 }
    );
  }
  return NextResponse.json({ booking });
}

type PatchBody = {
  status?: string;
  action?: string;
};

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;
  const { session } = guard;
  const meta = requestMeta(req);

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.status) {
    return NextResponse.json(
      { error: "`status` is required" },
      { status: 400 }
    );
  }
  if (!ALLOWED_STATUSES.has(body.status as TicketStatus)) {
    return NextResponse.json(
      { error: `Unknown status: ${body.status}` },
      { status: 400 }
    );
  }
  const nextStatus = body.status as TicketStatus;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { reference: params.reference },
        include: { ticket: true },
      });
      if (!booking) throw new NotFound();

      const oldStatus = booking.ticket.status;
      if (oldStatus === nextStatus) {
        // No-op — still record it for the audit trail so compliance can see
        // who confirmed the state.
        await recordTicketHistory(tx, {
          ticketId: booking.ticket.id,
          action: body.action ?? "STATUS_CONFIRMED",
          oldStatus,
          newStatus: nextStatus,
          changes: null,
          source: "ADMIN_PANEL",
          changedBy: session.sub,
          request: meta,
        });
        return booking;
      }

      const ticket = await tx.ticket.update({
        where: { id: booking.ticket.id },
        data: { status: nextStatus },
      });

      await recordTicketHistory(tx, {
        ticketId: ticket.id,
        action: body.action ?? "STATUS_CHANGE",
        oldStatus,
        newStatus: nextStatus,
        changes: diffChanges(
          { status: oldStatus },
          { status: nextStatus }
        ),
        source: "ADMIN_PANEL",
        changedBy: session.sub,
        request: meta,
      });

      return await tx.booking.findUnique({
        where: { id: booking.id },
        include: { ticket: { include: { history: { orderBy: { timestamp: "asc" } } } } },
      });
    });

    return NextResponse.json({ booking: updated });
  } catch (err) {
    if (err instanceof NotFound) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }
    throw err;
  }
}

class NotFound extends Error {}
