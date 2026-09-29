import { NextResponse, type NextRequest } from "next/server";
import { CashCollectorError, resolveCashCollector } from "@/lib/finance/cash";
import { Prisma, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { requestMeta } from "@/lib/tickets/history";
import {
  updateTicketStatus,
  TicketNotFoundError,
} from "@/lib/tickets/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ reference: string }> };

const ALLOWED_STATUSES = new Set<TicketStatus>([
  TicketStatus.RESERVED,
  TicketStatus.PAID_ONLINE,
  TicketStatus.PAID_CASH,
  TicketStatus.CANCELLED,
  TicketStatus.REFUNDED,
]);

/**
 * GET  /api/admin/bookings/[reference]   -> booking + full audit trail
 * PATCH /api/admin/bookings/[reference]  -> admin changes status (delegates
 *                                           to updateTicketStatus service)
 */
export async function GET(_req: NextRequest, props: Params) {
  const params = await props.params;
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
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  return NextResponse.json({ booking });
}

type PatchBody = {
  status?: string;
  action?: string;
  /** PAID_CASH only: "ME" (this admin / cash desk holds it) or "CARRIER". */
  cashCollector?: string;
};

export async function PATCH(req: NextRequest, props: Params) {
  const params = await props.params;
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
    return NextResponse.json({ error: "`status` is required" }, { status: 400 });
  }
  if (!ALLOWED_STATUSES.has(body.status as TicketStatus)) {
    return NextResponse.json(
      { error: `Unknown status: ${body.status}` },
      { status: 400 }
    );
  }
  const nextStatus = body.status as TicketStatus;

  const booking = await prisma.booking.findUnique({
    where: { reference: params.reference },
    select: { id: true, ticket: { select: { id: true } } },
  });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  let cashCollector;
  if (nextStatus === TicketStatus.PAID_CASH) {
    try {
      cashCollector = await resolveCashCollector(session.sub, body.cashCollector);
    } catch (err) {
      if (err instanceof CashCollectorError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  try {
    await updateTicketStatus(booking.ticket.id, nextStatus, session.sub, {
      source: "ADMIN_PANEL",
      action: body.action,
      request: meta,
      cashCollector,
    });
  } catch (err) {
    if (err instanceof TicketNotFoundError) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    throw err;
  }

  const fresh = await prisma.booking.findUnique({
    where: { id: booking.id },
    include: {
      ticket: {
        include: {
          history: { orderBy: { timestamp: "asc" } },
          trip: { include: { carrier: true } },
        },
      },
    },
  });
  return NextResponse.json({ booking: fresh });
}
