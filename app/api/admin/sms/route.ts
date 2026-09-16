import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { sendSms } from "@/lib/sms";
import { recordTicketHistory, requestMeta } from "@/lib/tickets/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IDS = 100;
const MAX_MESSAGE = 500;

/**
 * POST /api/admin/sms { ticketIds: string[], message: string }
 * ADMIN-only bulk SMS: sends the same message to the passenger phone of each
 * given ticket and records an SMS_SENT entry in every ticket's history
 * (with the message text and the delivery result).
 */
export async function POST(req: NextRequest) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  let body: { ticketIds?: string[]; message?: string };
  try {
    body = (await req.json()) as { ticketIds?: string[]; message?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ticketIds = [
    ...new Set((body.ticketIds ?? []).map((s) => String(s).trim()).filter(Boolean)),
  ];
  const message = (body.message ?? "").trim();

  if (ticketIds.length === 0) {
    return NextResponse.json(
      { error: "Provide at least one ticket id in `ticketIds`" },
      { status: 400 }
    );
  }
  if (ticketIds.length > MAX_IDS) {
    return NextResponse.json(
      { error: `Too many tickets — max ${MAX_IDS} per send` },
      { status: 400 }
    );
  }
  if (message.length === 0) {
    return NextResponse.json({ error: "`message` must not be empty" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE) {
    return NextResponse.json(
      { error: `Message too long — max ${MAX_MESSAGE} characters` },
      { status: 400 }
    );
  }

  const tickets = await prisma.ticket.findMany({
    where: { id: { in: ticketIds } },
    include: { booking: { select: { phone: true, reference: true } } },
  });
  if (tickets.length === 0) {
    return NextResponse.json({ error: "No tickets found" }, { status: 404 });
  }

  const meta = requestMeta(req);
  const results: {
    ticketId: string;
    reference: string | null;
    phone: string | null;
    ok: boolean;
    error?: string;
  }[] = [];

  for (const ticket of tickets) {
    const phone = ticket.booking?.phone ?? null;
    let ok = false;
    let error: string | undefined;

    if (!phone) {
      error = "Ticket has no passenger phone";
    } else {
      const sent = await sendSms(phone, message);
      ok = sent.ok;
      error = sent.error;
    }

    await recordTicketHistory(prisma, {
      ticketId: ticket.id,
      action: ok ? "SMS_SENT" : "SMS_FAILED",
      changes: {
        sms: { from: null, to: message },
        phone: { from: null, to: phone ?? "—" },
        ...(error ? { error: { from: null, to: error } } : {}),
      },
      source: "ADMIN_PANEL",
      changedBy: guard.session.sub,
      request: meta,
    });

    results.push({
      ticketId: ticket.id,
      reference: ticket.booking?.reference ?? null,
      phone,
      ok,
      error,
    });
  }

  const sent = results.filter((r) => r.ok).length;
  return NextResponse.json({
    sent,
    failed: results.length - sent,
    results,
  });
}
