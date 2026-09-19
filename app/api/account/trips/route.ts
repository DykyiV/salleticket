import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { listInternalTrips } from "@/lib/trips/internal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  const from = req.nextUrl.searchParams.get("from")?.trim() ?? "";
  const to = req.nextUrl.searchParams.get("to")?.trim() ?? "";
  const date = req.nextUrl.searchParams.get("date")?.trim() ?? "";
  if (!from || !to || !date) {
    return NextResponse.json(
      { error: "Потрібні from, to і date" },
      { status: 400 }
    );
  }

  try {
    const trips = await listInternalTrips({ fromCity: from, toCity: to, date });
    return NextResponse.json({ trips });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Некоректна дата" },
      { status: 400 }
    );
  }
}
