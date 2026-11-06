import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { gtTripPassengers } from "@/lib/carriers/grandes-tour/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const { tripId } = await params;
  const id = Number(tripId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid tripId" }, { status: 400 });
  }

  const sp = req.nextUrl.searchParams;
  const occupancy = await gtTripPassengers(id, Number(sp.get("from")) || undefined, Number(sp.get("to")) || undefined);
  return NextResponse.json(occupancy);
}
