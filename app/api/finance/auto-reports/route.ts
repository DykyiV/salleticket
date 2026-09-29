import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import {
  AutoReportInputError,
  getAutoReportsEnabled,
  listAutoReportRows,
  parseAutoReportSave,
  saveAutoReports,
} from "@/lib/finance/autoReports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/finance/auto-reports — global switch + per-counterparty rows. */
export async function GET() {
  const guard = await requirePermission("finance.read");
  if (!guard.ok) return guard.response;
  const [enabled, rows] = await Promise.all([getAutoReportsEnabled(), listAutoReportRows()]);
  return NextResponse.json({ enabled, ...rows });
}

/**
 * PUT /api/finance/auto-reports
 * { enabled?: boolean, rows: [{ kind, id, enabled, sendDay, email, rewardPercent? }] }
 */
export async function PUT(req: NextRequest) {
  const guard = await requirePermission("finance.edit");
  if (!guard.ok) return guard.response;
  let input;
  try {
    input = parseAutoReportSave(await req.json());
    await saveAutoReports(input);
  } catch (err) {
    if (err instanceof AutoReportInputError || err instanceof SyntaxError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
  const [enabled, rows] = await Promise.all([getAutoReportsEnabled(), listAutoReportRows()]);
  return NextResponse.json({ enabled, ...rows });
}
