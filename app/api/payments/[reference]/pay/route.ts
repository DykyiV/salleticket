import { NextResponse, type NextRequest } from "next/server";
import { PaymentStatus, TicketStatus } from "@prisma/client";
import { requireAuth } from "@/lib/auth/guard";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";
import { getSiteSettings } from "@/lib/settings";
import { reconcileTicketPayment } from "@/lib/payments";
import { recordTicketHistory, requestMeta } from "@/lib/tickets/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { reference: string } };

/**
 * Mock payment-system callback: the passenger confirmed the payment, funds
 * are on the way. The ticket stays AWAITING_PAYMENT until the settle window
 * (20–30 min by default) passes and reconciliation marks it PAID_ONLINE.
 */
export async function POST(req: NextRequest, { params }: Params) {
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

  const payment = booking.ticket.payments[0];
  if (!payment) {
    return NextResponse.json(
      { error: "Для цього квитка немає онлайн-оплати" },
      { status: 400 }
    );
  }
  if (booking.ticket.status !== TicketStatus.AWAITING_PAYMENT) {
    return NextResponse.json(
      { error: "Квиток уже не очікує оплату" },
      { status: 409 }
    );
  }
  if (payment.status === PaymentStatus.EXPIRED) {
    return NextResponse.json(
      { error: "Час на оплату зі знижкою минув" },
      { status: 409 }
    );
  }

  const settings = await getSiteSettings();
  const now = new Date();
  const updated =
    payment.status === PaymentStatus.SENT
      ? payment
      : await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.SENT,
            sentAt: now,
            settleAfter: new Date(
              now.getTime() + settings.paymentSettleMinutes * 60_000
            ),
            providerRef: `MOCK-${Math.random()
              .toString(36)
              .slice(2, 10)
              .toUpperCase()}`,
          },
        });

  await recordTicketHistory(prisma, {
    ticketId: booking.ticket.id,
    action: "PAYMENT_STARTED",
    source: "ACCOUNT",
    changedBy: guard.session.sub,
    request: requestMeta(req),
    changes: {
      paymentStatus: { from: payment.status, to: updated.status },
      providerRef: { from: null, to: updated.providerRef },
    },
  });

  return NextResponse.json({
    payment: {
      id: updated.id,
      status: updated.status,
      amount: updated.amount,
      sentAt: updated.sentAt,
      settleAfter: updated.settleAfter,
      deadlineAt: updated.deadlineAt,
    },
    ticketStatus: booking.ticket.status,
  });
}
