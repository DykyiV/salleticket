import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { gtLowestPrices } from "@/lib/carriers/grandes-tour";
import { grandesTourEnabled } from "@/lib/carriers/grandes-tour/client";
import { cityNames } from "@/lib/trips/cities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; prices: Record<string, number> }>();

/**
 * Lowest fare per departure day of one month for a route (date picker):
 * GET /api/calendar?from=…&to=…&month=YYYY-MM → { prices: { "2026-11-05": 81 }, currency }.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const from = cityNames(sp.get("from") ?? "")[0];
  const to = cityNames(sp.get("to") ?? "")[0];
  const month = sp.get("month") ?? "";
  if (!from || !to || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "from, to and month=YYYY-MM are required" }, { status: 400 });
  }
  const key = `${from}|${to}|${month}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json({ prices: hit.prices, currency: "EUR" });

  const today = new Date().toISOString().slice(0, 10);
  const first = `${month}-01`;
  const start = first < today ? today : first;
  const end = new Date(`${first}T00:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);

  const prices: Record<string, number> = {};
  const put = (day: string, price: number) => {
    if (day.startsWith(month) && (prices[day] == null || price < prices[day])) prices[day] = price;
  };

  const [gt, own] = await Promise.all([
    grandesTourEnabled() ? gtLowestPrices(from, to, start).catch(() => ({})) : Promise.resolve({}),
    prisma.trip
      .findMany({
        where: {
          fromCity: { in: cityNames(from) },
          toCity: { in: cityNames(to) },
          departureTime: { gte: new Date(`${start}T00:00:00Z`), lt: end },
          departureId: { not: null },
        },
        select: { departureTime: true, price: true },
      })
      .catch(() => []),
  ]);
  for (const [day, price] of Object.entries(gt)) put(day, price);
  for (const t of own) put(t.departureTime.toISOString().slice(0, 10), t.price);

  cache.set(key, { at: Date.now(), prices });
  return NextResponse.json({ prices, currency: "EUR" });
}
