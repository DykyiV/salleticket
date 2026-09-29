import { NextResponse, type NextRequest } from "next/server";
import { reconcileDuePayments } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/cron/payments — Authorization: Bearer <CRON_SECRET>
 *
 * Hourly (.github/workflows/payments.yml): settles online payments whose
 * funds arrived and cancels bookings whose pay-before deadline passed
 * (passenger notified by SMS + e-mail). The same sweep also runs lazily
 * whenever ticket lists or a ticket are opened.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured on the server" }, { status: 503 });
  }
  if ((req.headers.get("authorization") ?? "") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const before = Date.now();
  await reconcileDuePayments();
  return NextResponse.json({ ok: true, ms: Date.now() - before });
}
