import { NextResponse, type NextRequest } from "next/server";
import {
  generateSettlements,
  markSettlementSent,
  previousPeriod,
} from "@/lib/settlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/cron/settlements
 * Authorization: Bearer <CRON_SECRET>
 *
 * Monthly job (runs on the 7th, see .github/workflows/settlements.yml):
 * generates settlements for the previous calendar month for every carrier
 * with unsettled sales, then marks them SENT (invoice + act dispatched).
 *
 * Email delivery itself is a stub — see markSettlementSent in
 * lib/settlements.ts for the integration point.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server" },
      { status: 503 }
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const period = previousPeriod();
  const generated = await generateSettlements(period);

  const sent = [];
  for (const s of generated) {
    const updated = await markSettlementSent(s.id);
    sent.push({ id: updated.id, invoiceNumber: updated.invoiceNumber, sentAt: updated.sentAt });
  }

  return NextResponse.json({
    period,
    generated: generated.length,
    sent: sent.length,
    settlements: generated,
  });
}
