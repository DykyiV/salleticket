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
 * Mock payment-system confirmation. Works for single tickets and for a
 * multi-passenger group (reference = groupRef): every pending payment in the
 * group is marked SENT and settles after the configured window.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  const first = await prisma.booking.findUnique({
    where: { reference: params.reference },
    include: { ticket: true },
  });
  if (!first) {
    return NextResponse.json({ error: "Квиток не знайдено" }, { status: 404 });
  }
  const staff = hasRoleAtLeast(guard.session.role, "AGENT");
  if (first.ticket.userId !== guard.session.sub && !staff) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const groupKey = first.groupRef ?? first.reference;
  const group = await prisma.booking.findMany({
    where: { OR: [{ groupRef: groupKey }, { reference: groupKey }] },
    include: {
      ticket: {
        include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
      },
    },
  });

  for (const row of group) {
    await reconcileTicketPayment(row.ticket.id);
  }

  const settings = await getSiteSettings();
  const now = new Date();
  const settleAfter = new Date(
    now.getTime() + settings.paymentSettleMinutes * 60_000
  );

  const paid: string[] = [];
  for (const row of group) {
    const payment = row.ticket.payments[0];
    if (!payment) continue;
    if (row.ticket.status !== TicketStatus.AWAITING_PAYMENT) continue;
    if (payment.status !== PaymentStatus.PENDING) continue;
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.SENT,
        sentAt: now,
        settleAfter,
        providerRef: `MOCK-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      },
    });
    await recordTicketHistory(prisma, {
      ticketId: row.ticket.id,
      action: "PAYMENT_STARTED",
      source: "ACCOUNT",
      changedBy: guard.session.sub,
      request: requestMeta(req),
      changes: {
        paymentStatus: { from: payment.status, to: PaymentStatus.SENT },
      },
    });
    paid.push(row.reference);
  }

  if (paid.length === 0) {
    return NextResponse.json(
      { error: "Немає оплат, що очікують надсилання" },
      { status: 409 }
    );
  }

  return NextResponse.json({ sent: paid, settleAfter });
}
