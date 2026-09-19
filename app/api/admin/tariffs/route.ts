import { NextResponse, type NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { parseMonthMultipliers, parseTiers } from "@/lib/pricing/grid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;
  if (!(await can({ role: guard.session.role }, "price.read"))) {
    return NextResponse.json({ error: "Немає дозволу price.read" }, { status: 403 });
  }

  const [countries, grids] = await Promise.all([
    prisma.country.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.tariffGrid.findMany(),
  ]);
  const byCountry = new Map(grids.map((g) => [g.countryId, g]));

  return NextResponse.json({
    countries: countries.map((country) => {
      const grid = byCountry.get(country.id);
      return {
        id: country.id,
        name: country.name,
        code: country.code,
        grid: grid
          ? {
              id: grid.id,
              capacity: grid.capacity,
              tiers: parseTiers(grid.tiers),
              monthMultipliers: parseMonthMultipliers(grid.monthMultipliers),
              earlyBirdDays: grid.earlyBirdDays,
              earlyBirdPercent: grid.earlyBirdPercent,
              lastMinuteDays: grid.lastMinuteDays,
              lastMinutePercent: grid.lastMinutePercent,
              minPrice: grid.minPrice,
              maxPrice: grid.maxPrice,
              isActive: grid.isActive,
            }
          : null,
      };
    }),
  });
}

type PutBody = {
  countryId?: string;
  capacity?: number;
  tiers?: { share: number; price: number }[];
  monthMultipliers?: Record<string, number>;
  earlyBirdDays?: number | null;
  earlyBirdPercent?: number | null;
  lastMinuteDays?: number | null;
  lastMinutePercent?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  isActive?: boolean;
};

export async function PUT(req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;
  if (!(await can({ role: guard.session.role }, "price.edit"))) {
    return NextResponse.json({ error: "Немає дозволу price.edit" }, { status: 403 });
  }

  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  if (!body.countryId) {
    return NextResponse.json({ error: "Вкажіть країну" }, { status: 400 });
  }
  const country = await prisma.country.findUnique({
    where: { id: body.countryId },
  });
  if (!country) {
    return NextResponse.json({ error: "Країну не знайдено" }, { status: 404 });
  }

  const tiers = Array.isArray(body.tiers)
    ? body.tiers
        .map((t) => ({ share: Number(t.share), price: Number(t.price) }))
        .filter(
          (t) => Number.isFinite(t.share) && t.share > 0 && Number.isFinite(t.price) && t.price >= 0
        )
    : [];
  if (!tiers.length) {
    return NextResponse.json(
      { error: "Додайте хоча б один рівень цін" },
      { status: 400 }
    );
  }
  const shareSum = tiers.reduce((sum, t) => sum + t.share, 0);
  if (Math.abs(shareSum - 1) > 0.001) {
    return NextResponse.json(
      { error: `Частки місць мають сумуватись до 100% (зараз ${Math.round(shareSum * 100)}%)` },
      { status: 400 }
    );
  }

  const months: Record<string, number> = {};
  for (const [key, value] of Object.entries(body.monthMultipliers ?? {})) {
    const month = Number(key);
    const mult = Number(value);
    if (month >= 1 && month <= 12 && Number.isFinite(mult) && mult > 0) {
      months[String(month)] = mult;
    }
  }

  const numOrNull = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

  const data = {
    capacity:
      typeof body.capacity === "number" && body.capacity > 0
        ? Math.round(body.capacity)
        : 46,
    tiers: JSON.stringify(tiers),
    monthMultipliers: JSON.stringify(months),
    earlyBirdDays: numOrNull(body.earlyBirdDays),
    earlyBirdPercent: numOrNull(body.earlyBirdPercent),
    lastMinuteDays: numOrNull(body.lastMinuteDays),
    lastMinutePercent: numOrNull(body.lastMinutePercent),
    minPrice: numOrNull(body.minPrice),
    maxPrice: numOrNull(body.maxPrice),
    isActive: body.isActive !== false,
  };

  const grid = await prisma.tariffGrid.upsert({
    where: { countryId: country.id },
    create: { countryId: country.id, ...data },
    update: data,
  });
  return NextResponse.json({ id: grid.id, countryId: grid.countryId });
}
