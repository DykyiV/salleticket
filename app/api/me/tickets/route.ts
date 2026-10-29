import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { requestOrigin } from "@/lib/tickets/eTicket";
import { loadMyOrders } from "@/lib/tickets/myOrders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «Мої квитки» as JSON for the mobile app: the signed-in passenger's orders,
 * upcoming first — the same list as the /tickets page. Never cached, so a
 * ticket bought on the site or at the office shows up on the next refresh.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;
  const orders = await loadMyOrders(guard.session.sub, requestOrigin(req));
  return NextResponse.json(orders, { headers: { "Cache-Control": "private, no-store" } });
}
