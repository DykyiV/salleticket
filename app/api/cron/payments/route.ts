import { NextResponse, type NextRequest } from "next/server";
import { checkCronAuth } from "@/lib/security/cron";
import { reconcileDuePayments } from "@/lib/payments";
import { closeNoShowReservations } from "@/lib/tickets/cashLimits";
import { syncCarrierCancellations } from "@/lib/tickets/carrierStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/cron/payments — Authorization: Bearer <CRON_SECRET>
 *
 * Hourly (.github/workflows/payments.yml): settles online payments whose
 * funds arrived and cancels bookings whose pay-before deadline passed
 * (passenger notified by SMS + e-mail). The same sweep also runs lazily
 * whenever ticket lists or a ticket are opened. Unpaid "pay on the bus"
 * reservations are closed as no-show 12 h after the trip arrived. Tickets
 * cancelled in the carrier's system (Grandes Tour) are cancelled here too.
 */
export async function POST(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  const before = Date.now();
  await reconcileDuePayments();
  const noShow = await closeNoShowReservations();
  const carrierCancelled = await syncCarrierCancellations();
  return NextResponse.json({ ok: true, noShow, carrierCancelled, ms: Date.now() - before });
}
