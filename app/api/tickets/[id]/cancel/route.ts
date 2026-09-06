import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { requestMeta } from "@/lib/tickets/history";
import { CancelError, cancelTicket } from "@/lib/tickets/cancel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cancel or refund a ticket — one endpoint, behavior branches on the
 * ticket's current status (see lib/tickets/cancel.ts):
 *   RESERVED    -> CANCELLED (owner, or staff with canCancelTickets)
 *   PAID_CASH   -> REFUNDED, 80/20 split by default (staff only)
 *   PAID_ONLINE -> REFUNDED via payment gateway (staff only)
 *
 * Not under /api/staff or /api/admin because the RESERVED case is
 * self-service — permission is checked inside cancelTicket() instead of by
 * middleware.ts's path-prefix rules.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  try {
    const outcome = await cancelTicket(
      params.id,
      { sub: guard.session.sub, role: guard.session.role },
      requestMeta(req)
    );
    return NextResponse.json({
      ticket: outcome.ticket,
      refundAmount: outcome.refundAmount,
      refundWithheld: outcome.refundWithheld,
    });
  } catch (err) {
    if (err instanceof CancelError) {
      return NextResponse.json(
        { error: err.message, reason: err.reason },
        { status: err.status }
      );
    }
    throw err;
  }
}
