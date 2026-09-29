import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";
import { startOnlinePayment, StartPaymentError } from "@/lib/payments";
import { VersionConflictError } from "@/lib/tickets/version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ reference: string }> };

/**
 * POST /api/payments/[reference]/start — "Оплатити онлайн" on a reserved
 * ticket: RESERVED → AWAITING_PAYMENT with the online discount and a
 * pay-before deadline. Returns the pay page URL.
 */
export async function POST(_req: Request, props: Params) {
  const { reference } = await props.params;
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  const booking = await prisma.booking.findUnique({
    where: { reference },
    select: { ticket: { select: { id: true, userId: true } } },
  });
  if (!booking) return NextResponse.json({ error: "Квиток не знайдено" }, { status: 404 });
  const staff = hasRoleAtLeast(guard.session.role, "AGENT");
  if (booking.ticket.userId !== guard.session.sub && !staff) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }
  try {
    const payment = await startOnlinePayment(booking.ticket.id, guard.session.sub);
    return NextResponse.json(
      { payment: { amount: payment.amount, deadlineAt: payment.deadlineAt }, payUrl: `/pay/${reference}` },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof StartPaymentError || err instanceof VersionConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
