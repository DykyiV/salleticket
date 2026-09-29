import { NextResponse, type NextRequest } from "next/server";
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
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured on the server" }, { status: 503 });
  }
  if ((req.headers.get("authorization") ?? "") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runAutoReports(new Date(), "cron"));
}
