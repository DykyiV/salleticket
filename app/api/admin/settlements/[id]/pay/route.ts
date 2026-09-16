import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { markSettlementPaid } from "@/lib/settlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/settlements/[id]/pay — mark the settlement as paid (money
 * transferred to whichever side the balance points to) and record a PAID
 * event in the calculation history.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  try {
    const settlement = await markSettlementPaid(id, guard.session.email);
    return NextResponse.json({ settlement });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Settlement not found" ? 404 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
