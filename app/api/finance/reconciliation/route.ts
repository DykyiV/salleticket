import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { getReconciliation } from "@/lib/finance/reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/finance/reconciliation — per carrier and per agent: accrued, paid,
 * open balance (positive = we owe them, negative = they owe us).
 */
export async function GET() {
  const guard = await requirePermission("finance.read");
  if (!guard.ok) return guard.response;
  return NextResponse.json(await getReconciliation());
}
