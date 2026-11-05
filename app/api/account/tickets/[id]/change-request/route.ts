import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { ticketRights } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { mailConfigured, sendMail } from "@/lib/mail";
import { notifyChangeRequested } from "@/lib/notify";
import { formatUkDate } from "@/lib/routes/dates";
import { CHANGE_REQUEST_PER_TICKET, blockedFor, limitKey, recordHit } from "@/lib/security/rateLimit";
import { getSiteContacts } from "@/lib/siteContacts";
import { kyivToday } from "@/lib/tickets/changeRules";
import { recordTicketHistory, requestMeta } from "@/lib/tickets/history";
import { requestOrigin, siteOrigin } from "@/lib/tickets/eTicket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST { leg: "outbound" | "return", date: "YYYY-MM-DD", comment? } — a
 * passenger asks to move a trip: the office gets an e-mail (company address
 * from Settings → Contacts) and a cabinet notification; the request is kept
 * in the ticket history. Staff then change it in the ticket.
 */
export async function POST(req: NextRequest, props: Params) {
  const params = await props.params;
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  let body: { leg?: string; date?: string; comment?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний запит" }, { status: 400 });
  }
  const leg = body.leg === "return" ? "return" : "outbound";
  const date = body.date ?? "";
  const comment = (body.comment ?? "").trim().slice(0, 1000);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < kyivToday()) {
    return NextResponse.json({ error: "Оберіть дату, не раніше сьогодні" }, { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: params.id },
    include: { trip: true, returnTrip: true },
  });
  const booking = ticket ? await prisma.booking.findFirst({ where: { ticketId: ticket.id } }) : null;
  if (!ticket || !booking) return NextResponse.json({ error: "Квиток не знайдено" }, { status: 404 });
  const rights = await ticketRights(guard.session, ticket);
  if (!rights.canView) return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  if (leg === "return" && ticket.tripKind === "ONE_WAY") {
    return NextResponse.json({ error: "Це квиток в одну сторону" }, { status: 400 });
  }

  const key = limitKey("change-request", ticket.id);
  const wait = await blockedFor(key, CHANGE_REQUEST_PER_TICKET);
  if (wait > 0) {
    return NextResponse.json(
      { error: "Запит уже надіслано — менеджер зв'яжеться з вами" },
      { status: 429, headers: { "Retry-After": String(wait) } }
    );
  }
  await recordHit(key, CHANGE_REQUEST_PER_TICKET);

  const trip = leg === "return" ? ticket.returnTrip : ticket.trip;
  const from = trip?.fromCity ?? (leg === "return" ? ticket.trip?.toCity : ticket.trip?.fromCity) ?? "";
  const to = trip?.toCity ?? (leg === "return" ? ticket.trip?.fromCity : ticket.trip?.toCity) ?? "";
  const seat = leg === "return" ? ticket.returnSeatNumber : ticket.seatNumber;
  const now = trip
    ? `${formatUkDate(trip.departureTime.toISOString())} ${trip.departureTime.toISOString().slice(11, 16)}${seat != null ? `, місце ${seat}` : ""}`
    : "відкрита дата";
  const summary = `${leg === "return" ? "Назад" : "Туди"}: ${from} → ${to}, зараз ${now} → бажана дата ${formatUkDate(date)}`;
  const link = `${siteOrigin(requestOrigin(req))}/cabinet/tickets/${booking.reference}`;

  let mailed = false;
  if (mailConfigured()) {
    const office = (await getSiteContacts()).email;
    const result = await sendMail({
      to: office,
      subject: `Запит на зміну дати ${booking.reference} — ${booking.firstName} ${booking.lastName}`,
      text: [
        `Клієнт просить змінити дату поїздки.`,
        ``,
        `Квиток: ${booking.reference} (${booking.firstName} ${booking.lastName})`,
        summary,
        comment ? `Коментар: ${comment}` : null,
        ``,
        `Клієнт: ${booking.email ?? guard.session.email}, ${booking.phone}`,
        `Відкрити квиток: ${link}`,
      ]
        .filter((line) => line !== null)
        .join("\n"),
    }).catch(() => null);
    mailed = Boolean(result?.delivered);
  }
  await notifyChangeRequested(booking.reference, summary + (comment ? ` · ${comment}` : "")).catch(() => undefined);
  await recordTicketHistory(prisma, {
    ticketId: ticket.id,
    action: "CHANGE_REQUESTED",
    source: rights.isStaff ? "ADMIN_PANEL" : "ACCOUNT",
    changedBy: guard.session.sub,
    request: requestMeta(req),
    changes: { leg: { from: null, to: leg }, date: { from: null, to: date }, ...(comment ? { comment: { from: null, to: comment } } : {}) },
  });
  return NextResponse.json({ ok: true, mailed });
}
