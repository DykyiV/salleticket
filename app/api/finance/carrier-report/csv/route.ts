import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { ROLE_LABEL } from "@/lib/auth/constants";
import { carrierReportCsv, getCarrierReport } from "@/lib/finance/carrierReport";
import { TICKET_STATUS_LABEL } from "@/lib/tickets/labels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/finance/carrier-report/csv?carrier=<id>&period=YYYY-MM[&kind=agents]
 * CSV of the carrier report — the passenger list by default, or the
 * per-agent breakdown with kind=agents. Same data as the page.
 */
export async function GET(req: NextRequest) {
  const guard = await requirePermission("finance.read");
  if (!guard.ok) return guard.response;

  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind") === "agents" ? "agents" : "tickets";
  const report = await getCarrierReport({
    carrier: sp.get("carrier") ?? undefined,
    period: sp.get("period") ?? undefined,
  });
  if (!report.carrier) {
    return NextResponse.json({ error: "No carriers yet" }, { status: 404 });
  }

  const csv = carrierReportCsv(report, kind, {
    status: (s) => TICKET_STATUS_LABEL[s] ?? s,
    role: (r) => ROLE_LABEL[r] ?? r,
  });
  const base = `carrier-report-${report.period}${kind === "agents" ? "-agents" : ""}`;
  const pretty = `${report.carrier.name} ${report.period}${kind === "agents" ? " агенти" : ""}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${base}.csv"; filename*=UTF-8''${encodeURIComponent(pretty)}`,
      "Cache-Control": "no-store",
    },
  });
}
