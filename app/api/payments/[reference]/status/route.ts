import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";
import { reconcileTicketPayment } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { reference: string } };

/** Polled by the payment page; reconciles the whole group before answering. */
export async function GET(_req: NextRequest, { params }: Params) {
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
    orderBy: { createdAt: "asc" },
  });

  for (const row of group) {
    await reconcileTicketPayment(row.ticket.id);
  }

  const fresh = await prisma.booking.findMany({
    where: { OR: [{ groupRef: groupKey }, { reference: groupKey }] },
    include: {
      ticket: {
        include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const items = fresh.map((row) => {
    const payment = row.ticket.payments[0] ?? null;
    return {
      reference: row.reference,
      passenger: `${row.firstName} ${row.lastName}`.trim(),
      ticketStatus: row.ticket.status,
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
    };
  });

  const total = items.reduce(
    (sum, item) => sum + (item.payment?.amount ?? 0),
    0
  );
  const allSettled =
    items.length > 0 &&
    items.every((item) => item.ticketStatus === "PAID_ONLINE");
  const anyWaiting = items.some(
    (item) =>
      item.ticketStatus === "AWAITING_PAYMENT" &&
      item.payment?.status === "SENT"
  );
  const anyPending = items.some(
    (item) =>
      item.ticketStatus === "AWAITING_PAYMENT" &&
      item.payment?.status === "PENDING"
  );

  return NextResponse.json({
    groupRef: groupKey,
    items,
    total: Math.round(total * 100) / 100,
    allSettled,
    anyWaiting,
    anyPending,
  });
}
