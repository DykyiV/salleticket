import { NextResponse, type NextRequest } from "next/server";
import { searchAllCarriers } from "@/lib/carriers/registry";
import type { SearchQuery } from "@/lib/carriers/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseQuery(searchParams: URLSearchParams): {
  ok: true;
  query: SearchQuery;
} | {
  ok: false;
  error: string;
} {
  const from = searchParams.get("from")?.trim() || "";
  const to = searchParams.get("to")?.trim() || "";
  const date = searchParams.get("date")?.trim() || undefined;
  const passengersRaw = searchParams.get("passengers");
  const passengers = passengersRaw ? Number.parseInt(passengersRaw, 10) : 1;

  if (!from) return { ok: false, error: "`from` is required" };
  if (!to) return { ok: false, error: "`to` is required" };
  if (Number.isNaN(passengers) || passengers < 1) {
    return { ok: false, error: "`passengers` must be a positive integer" };
  }

  return { ok: true, query: { from, to, date, passengers } };
}

export async function GET(req: NextRequest) {
  const parsed = parseQuery(req.nextUrl.searchParams);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error },
      { status: 400 }
    );
  }

  const results = await searchAllCarriers(parsed.query);

  const trips = results.flatMap((r) => r.trips);
  const errors = results
    .filter((r) => r.error)
    .map((r) => ({ carrierId: r.carrierId, error: r.error as string }));

  return NextResponse.json(
    {
      query: parsed.query,
      carriers: results.map((r) => ({
        id: r.carrierId,
        name: r.carrierName,
        tripCount: r.trips.length,
        error: r.error,
      })),
      trips,
      errors,
      meta: {
        total: trips.length,
        cheapest:
          trips.length > 0
            ? trips.reduce((min, t) => (t.price < min ? t.price : min), Infinity)
            : null,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { from, to, date, passengers } = (body ?? {}) as Partial<SearchQuery>;
  if (!from || !to) {
    return NextResponse.json(
      { error: "`from` and `to` are required" },
      { status: 400 }
    );
  }

  const results = await searchAllCarriers({
    from,
    to,
    date,
    passengers: passengers ?? 1,
  });
  const trips = results.flatMap((r) => r.trips);

  return NextResponse.json({ trips, carriers: results });
}
