import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import {
  generateSettlements,
  getPeriodReport,
  getSettlementHistory,
  isValidPeriod,
  listSettlements,
  previousPeriod,
} from "@/lib/settlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/settlements?period=YYYY-MM
 * Live per-carrier sales report for the period plus already-generated
 * settlements and the recent calculation history. Defaults to the previous
 * calendar month.
 */
export async function GET(req: NextRequest) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const period = req.nextUrl.searchParams.get("period") ?? previousPeriod();
  if (!isValidPeriod(period)) {
    return NextResponse.json(
      { error: "Invalid period — expected YYYY-MM" },
      { status: 400 }
    );
  }

  const [report, settlements, history] = await Promise.all([
    getPeriodReport(period),
    listSettlements(period),
    getSettlementHistory(50),
  ]);

  return NextResponse.json({ period, report, settlements, history });
}

/**
 * POST /api/admin/settlements { "period": "YYYY-MM" }
 * Generate settlements (invoice + act numbers) for every carrier with
 * unsettled sales in the period. Idempotent per carrier.
 */
export async function POST(req: NextRequest) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  let body: { period?: string };
  try {
    body = (await req.json()) as { period?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const period = body.period ?? previousPeriod();
  if (!isValidPeriod(period)) {
    return NextResponse.json(
      { error: "Invalid period — expected YYYY-MM" },
      { status: 400 }
    );
  }

  const generated = await generateSettlements(period, guard.session.email);
  return NextResponse.json(
    { period, generated, count: generated.length },
    { status: generated.length > 0 ? 201 : 200 }
  );
}
