import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { reconcileTicketPayment } from "@/lib/payments";
import { requestOrigin, toETicket, viewableGroup } from "@/lib/tickets/eTicket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ reference: string }> };

/**
 * One order's e-tickets as JSON (mobile app ticket screen): the same model as
 * the ticket page, PDF and e-mail. Pending online payments are settled or
 * expired first, like on the page. Someone else's ticket → 404.
 */
export async function GET(req: NextRequest, props: Params) {
  const { reference } = await props.params;
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  const before = await viewableGroup(reference, guard.session);
  if (!before) return NextResponse.json({ error: "Квиток не знайдено" }, { status: 404 });
  await Promise.all(before.map((b) => reconcileTicketPayment(b.ticketId)));
  const group = (await viewableGroup(reference, guard.session)) ?? before;

  const origin = requestOrigin(req);
  return NextResponse.json(
    { reference, tickets: group.map((b) => toETicket(b, origin)) },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
