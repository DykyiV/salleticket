import { NextResponse, type NextRequest } from "next/server";
import { listInternalTrips, upcomingInternalTrips } from "@/lib/trips/internal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from")?.trim() ?? "";
  const to = req.nextUrl.searchParams.get("to")?.trim() ?? "";
  const date = req.nextUrl.searchParams.get("date")?.trim() ?? "";
  if (!from || !to) {
    return NextResponse.json({ error: "Потрібні from і to" }, { status: 400 });
  }

  try {
    const exact = date
      ? await listInternalTrips({ fromCity: from, toCity: to, date })
      : [];
    if (exact.length > 0) {
      return NextResponse.json({ trips: exact, nearby: false });
    }
    const trips = await upcomingInternalTrips({
      fromCity: from,
      toCity: to,
      take: 10,
    });
    return NextResponse.json({ trips, nearby: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Некоректна дата" },
      { status: 400 }
    );
  }
}
