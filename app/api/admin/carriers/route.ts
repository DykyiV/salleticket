import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { gtCarrierBuses, offsetDate, todayIso } from "@/lib/carriers/grandes-tour/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const from = todayIso();
  const to = offsetDate(30);

  const carriers = await gtCarrierBuses(from, to);
  return NextResponse.json({
    carriers,
    source: "gt-trips",
    asOf: todayIso(),
  });
}
