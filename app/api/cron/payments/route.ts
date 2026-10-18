import { NextResponse, type NextRequest } from "next/server";
import { checkCronAuth } from "@/lib/security/cron";
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
  const denied = checkCronAuth(req);
  if (denied) return denied;
  const before = Date.now();
  await reconcileDuePayments();
  return NextResponse.json({ ok: true, ms: Date.now() - before });
}
