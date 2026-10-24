import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { getLang } from "@/lib/i18n/server";
import { mailConfigured } from "@/lib/mail";
import {
  blockedFor,
  limitKey,
  recordHit,
  TICKET_MAIL_PER_ORDER,
  TICKET_MAIL_PER_USER,
} from "@/lib/security/rateLimit";
import { requestOrigin, viewableGroup } from "@/lib/tickets/eTicket";
import { sendTicketsEmail } from "@/lib/tickets/ticketMail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ reference: string }> };

/**
 * «Надіслати на e-mail»: sends the order's tickets (PDF attached) to the
 * e-mail given in the order — never to an address typed in by the visitor.
 * Limited to 3 per order and 10 per account an hour.
 */
export async function POST(req: NextRequest, props: Params) {
  const { reference } = await props.params;
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;
  const { session } = guard;

  const group = await viewableGroup(reference, session);
  if (!group) return NextResponse.json({ error: "Квиток не знайдено" }, { status: 404 });
  const live = group.filter((b) => b.ticket.status !== "CANCELLED" && b.ticket.status !== "REFUNDED");
  const to = live.find((b) => b.email)?.email ?? null;
  if (!live.length || !to) return NextResponse.json({ status: "no_email" }, { status: 409 });
  if (!mailConfigured()) return NextResponse.json({ status: "not_configured" }, { status: 503 });

  const orderKey = limitKey("ticket-mail", group[0].groupRef ?? group[0].reference);
  const userKey = limitKey("ticket-mail-user", session.sub);
  const wait = Math.max(await blockedFor(orderKey, TICKET_MAIL_PER_ORDER), await blockedFor(userKey, TICKET_MAIL_PER_USER));
  if (wait > 0) {
    return NextResponse.json({ status: "limited" }, { status: 429, headers: { "Retry-After": String(wait) } });
  }
  await Promise.all([recordHit(orderKey, TICKET_MAIL_PER_ORDER), recordHit(userKey, TICKET_MAIL_PER_USER)]);

  const result = await sendTicketsEmail(live, {
    lang: await getLang(),
    origin: requestOrigin(req),
    changedBy: session.sub,
    source: "ACCOUNT",
  });
  if (!result.delivered) return NextResponse.json({ status: "failed" }, { status: 502 });
  return NextResponse.json({ status: "sent", to: result.to });
}
