import { NextResponse, type NextRequest } from "next/server";
import { limitPublic, SEARCH_PER_IP } from "@/lib/security/publicLimit";
import { listInternalTrips, upcomingInternalTrips } from "@/lib/trips/internal";
import { grandesTourCarrierAdapter } from "@/lib/carriers/grandes-tour";
import { grandesTourEnabled } from "@/lib/carriers/grandes-tour/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limited = await limitPublic(req, "trips", SEARCH_PER_IP);
  if (limited) return limited;
  const from = req.nextUrl.searchParams.get("from")?.trim() ?? "";
  const to = req.nextUrl.searchParams.get("to")?.trim() ?? "";
  const date = req.nextUrl.searchParams.get("date")?.trim() ?? "";
  if (!from || !to) {
    return NextResponse.json({ error: "Потрібні from і to" }, { status: 400 });
  }

  // Return trips of a partner carrier (round trip on Grandes Tour).
  if (req.nextUrl.searchParams.get("carrier") === "grandes-tour") {
    if (!grandesTourEnabled() || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ trips: [], nearby: false });
    try {
      const found = await grandesTourCarrierAdapter.search({ from, to, date });
      const trips = found
        .filter((t) => (t.departureAt ?? "").startsWith(date) && t.seatsLeft > 0)
        .map((t) => ({
          id: t.id,
          fromCity: t.from,
          toCity: t.to,
          departureTime: t.departureAt ?? `${date}T${t.departure}:00.000Z`,
          price: t.price,
          carrier: t.carrier,
          hasAssignedSeats: true,
        }));
      return NextResponse.json({ trips, nearby: false });
    } catch {
      return NextResponse.json({ trips: [], nearby: false });
    }
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
