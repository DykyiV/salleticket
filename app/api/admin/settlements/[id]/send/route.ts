import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { markSettlementSent } from "@/lib/settlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/settlements/[id]/send — mark the settlement (invoice + act)
 * as sent to the carrier.
 *
 * NOTE: email delivery is a stub — integrate SMTP / a transactional email
 * provider in lib/settlements.ts (markSettlementSent) when credentials exist.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  try {
    const settlement = await markSettlementSent(id);
    return NextResponse.json({ settlement });
  } catch {
    return NextResponse.json({ error: "Settlement not found" }, { status: 404 });
  }
}
