import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { gtListTrips, todayIso, offsetDate } from "@/lib/carriers/grandes-tour/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from") || todayIso();
  const to = searchParams.get("to") || offsetDate(14);

  const trips = await gtListTrips(from, to);
  return NextResponse.json({ trips, from, to });
}
