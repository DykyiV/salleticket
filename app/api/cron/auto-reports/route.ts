import { NextResponse, type NextRequest } from "next/server";
import { checkCronAuth } from "@/lib/security/cron";
import { runAutoReports } from "@/lib/finance/autoReports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/cron/auto-reports — Authorization: Bearer <CRON_SECRET>
 *
 * Daily job (.github/workflows/settlements.yml). Sends last month's report
 * to every carrier / agent whose checkbox is on and whose day has come.
 * Does nothing while the global switch in Фінанси → Автозвіти is off.
 */
export async function POST(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  return NextResponse.json(await runAutoReports(new Date(), "cron"));
}
