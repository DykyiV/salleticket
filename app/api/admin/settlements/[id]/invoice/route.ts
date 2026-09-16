import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { getSettlementLines } from "@/lib/settlements";
import { renderInvoice } from "@/lib/settlementDocuments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/settlements/[id]/invoice — printable HTML рахунок-фактура. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const data = await getSettlementLines(id);
  if (!data) {
    return NextResponse.json({ error: "Settlement not found" }, { status: 404 });
  }

  return new Response(renderInvoice(data), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
