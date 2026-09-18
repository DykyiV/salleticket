import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";
import { reconcileTicketPayment } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { reference: string } };

/** Polled by the payment page; reconciles before answering. */
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  const booking = await prisma.booking.findUnique({
    where: { reference: params.reference },
    include: {
      ticket: {
        include: {
          payments: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!booking) {
    return NextResponse.json({ error: "Квиток не знайдено" }, { status: 404 });
  }
  const staff = hasRoleAtLeast(guard.session.role, "AGENT");
  if (booking.ticket.userId !== guard.session.sub && !staff) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  await reconcileTicketPayment(booking.ticket.id);

  const fresh = await prisma.ticket.findUnique({
    where: { id: booking.ticket.id },
    include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const payment = fresh?.payments[0] ?? null;

  return NextResponse.json({
    ticketStatus: fresh?.status ?? booking.ticket.status,
    finalPrice: fresh?.finalPrice ?? booking.finalPrice,
    payment: payment
      ? {
          status: payment.status,
          amount: payment.amount,
          fullAmount: payment.fullAmount,
          sentAt: payment.sentAt,
          settleAfter: payment.settleAfter,
          deadlineAt: payment.deadlineAt,
        }
      : null,
  });
}
