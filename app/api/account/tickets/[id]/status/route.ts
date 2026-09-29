import { NextResponse, type NextRequest } from "next/server";
import { TicketStatus } from "@prisma/client";
import { requireAuth } from "@/lib/auth/guard";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";
import { requestMeta } from "@/lib/tickets/history";
import { isStatusTransitionAllowed, TICKET_STATUS_LABEL } from "@/lib/tickets/labels";
import { TicketNotFoundError, updateTicketStatus } from "@/lib/tickets/service";import { VersionConflictError } from "@/lib/tickets/version";
import { can } from "@/lib/auth/permissions";
import { notifyRefundRequested, notifySeatFreed } from "@/lib/notify";
import { CashCollectorError, resolveCashCollector } from "@/lib/finance/cash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const ALLOWED = new Set<TicketStatus>(Object.values(TicketStatus));

export async function PATCH(req: NextRequest, props: Params) {
  const params = await props.params;
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  let body: { status?: string; cashCollector?: string };
  try {
    body = (await req.json()) as { status?: string; cashCollector?: string };
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  if (!body.status || !ALLOWED.has(body.status as TicketStatus)) {
    return NextResponse.json({ error: "Некоректний статус" }, { status: 400 });
  }
  const nextStatus = body.status as TicketStatus;
  if (
    body.cashCollector !== undefined &&
    body.cashCollector !== "ME" &&
    body.cashCollector !== "CARRIER"
  ) {
    return NextResponse.json(
      { error: "`cashCollector` має бути ME або CARRIER" },
      { status: 400 }
    );
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: params.id },
    select: { userId: true, status: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Квиток не знайдено" }, { status: 404 });
  }

  const isOwner = ticket.userId === guard.session.sub;
  const isStaff = hasRoleAtLeast(guard.session.role, "AGENT");
  if (!isOwner && !isStaff) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  if (isStaff) {
    const needed =
      nextStatus === "CANCELLED"
        ? "booking.cancel"
        : nextStatus === "REFUNDED"
          ? "payment.refund"
          : "booking.edit";
    if (!(await can({ role: guard.session.role }, needed))) {
      return NextResponse.json(
        { error: `Немає дозволу ${needed}` },
        { status: 403 }
      );
    }
  }

  if (!isStaff) {
    if (ticket.status !== "RESERVED" || nextStatus !== "CANCELLED") {
      return NextResponse.json(
        { error: "Можна скасувати лише незаплачений квиток" },
        { status: 409 }
      );
    }
  } else if (!isStatusTransitionAllowed(ticket.status, nextStatus)) {
    return NextResponse.json(
      {
        error: `Не можна змінити «${TICKET_STATUS_LABEL[ticket.status]}» на «${TICKET_STATUS_LABEL[nextStatus]}»`,
      },
      { status: 409 }
    );
  }

  // Paid in cash: record who holds the money (agent / desk or the driver).
  let cashCollector;
  if (nextStatus === "PAID_CASH") {
    try {
      cashCollector = await resolveCashCollector(guard.session.sub, body.cashCollector);
    } catch (err) {
      if (err instanceof CashCollectorError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  try {
    const result = await updateTicketStatus(
      params.id,
      nextStatus,
      guard.session.sub,
      {
        source: isStaff ? "ADMIN_PANEL" : "ACCOUNT",
        action: !isStaff ? "CANCELLED_BY_OWNER" : "STATUS_CHANGE",
        request: requestMeta(req),
        cashCollector,
      }
    );
    if (result.changed) {
      const booking = await prisma.booking.findFirst({
        where: { ticketId: params.id },
        select: { reference: true },
      });
      if (nextStatus === "REFUNDED" && booking) {
        await notifyRefundRequested(booking.reference);
      }
      if (nextStatus === "CANCELLED" && booking) {
        const seat = await prisma.ticket.findUnique({
          where: { id: params.id },
          select: { seatNumber: true },
        });
        await notifySeatFreed(booking.reference, seat?.seatNumber ?? null);
      }
    }
    return NextResponse.json({
      ticket: result.ticket,
      oldStatus: result.oldStatus,
      newStatus: result.newStatus,
    });
  } catch (err) {    if (err instanceof TicketNotFoundError) {
      return NextResponse.json({ error: "Квиток не знайдено" }, { status: 404 });
    }
    if (err instanceof VersionConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Не вдалося змінити статус" },
      { status: 500 }
    );
  }
}
