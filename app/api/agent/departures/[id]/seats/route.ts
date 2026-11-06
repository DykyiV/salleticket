import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { departureSeatCounts } from "@/lib/departures/board";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/agent/departures/gt-31189/seats?from=<city id>&to=<city id> → seat counts for the Виїзди bar. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("AGENT");
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const counts = await departureSeatCounts(id, Number(sp.get("from")), Number(sp.get("to")));
  return NextResponse.json({ counts });
}
