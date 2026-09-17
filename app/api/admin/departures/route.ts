import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { utcDateOnly, addUtcDays, todayUtc } from "@/lib/routes/dates";
import { toDepartureDTO } from "@/lib/routes/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const include = {
  template: { include: { country: true } },
  stops: { orderBy: { sortOrder: "asc" as const } },
};

export async function GET(req: NextRequest) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const params = req.nextUrl.searchParams;
  const fromRaw = params.get("from");
  const toRaw = params.get("to");
  const templateId = params.get("templateId");
  const countryId = params.get("countryId");

  let from: Date;
  let to: Date;
  try {
    from = fromRaw ? utcDateOnly(fromRaw) : todayUtc();
    to = toRaw ? utcDateOnly(toRaw) : addUtcDays(from, 60);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid date" },
      { status: 400 }
    );
  }

  const rows = await prisma.departure.findMany({
    where: {
      date: { gte: from, lte: to },
      ...(templateId ? { templateId } : {}),
      ...(countryId ? { template: { countryId } } : {}),
    },
    include,
    orderBy: [{ date: "asc" }, { template: { name: "asc" } }],
  });

  return NextResponse.json({
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    departures: rows.map(toDepartureDTO),
  });
}
