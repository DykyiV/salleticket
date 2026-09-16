import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidPercent(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100;
}

/**
 * GET /api/admin/commissions
 * All carriers with their default commission and route-specific rules.
 */
export async function GET() {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const carriers = await prisma.carrier.findMany({
    include: { commissionRules: { orderBy: [{ fromCity: "asc" }, { toCity: "asc" }] } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ carriers });
}

/**
 * PATCH /api/admin/commissions { carrierId, percent }
 * Update a carrier's default commission (applies when no route rule matches).
 * Affects only future bookings — ticket snapshots are immutable.
 */
export async function PATCH(req: NextRequest) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  let body: { carrierId?: string; percent?: number };
  try {
    body = (await req.json()) as { carrierId?: string; percent?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.carrierId || !isValidPercent(body.percent)) {
    return NextResponse.json(
      { error: "`carrierId` and `percent` (0..100) are required" },
      { status: 400 }
    );
  }

  try {
    const carrier = await prisma.carrier.update({
      where: { id: body.carrierId },
      data: { commissionPercent: body.percent },
    });
    return NextResponse.json({ carrier });
  } catch {
    return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
  }
}

/**
 * POST /api/admin/commissions { carrierId, fromCity, toCity, percent }
 * Create or update a route-specific commission rule (upsert).
 */
export async function POST(req: NextRequest) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  let body: {
    carrierId?: string;
    fromCity?: string;
    toCity?: string;
    percent?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fromCity = body.fromCity?.trim();
  const toCity = body.toCity?.trim();
  if (!body.carrierId || !fromCity || !toCity || !isValidPercent(body.percent)) {
    return NextResponse.json(
      { error: "`carrierId`, `fromCity`, `toCity` and `percent` (0..100) are required" },
      { status: 400 }
    );
  }

  try {
    const rule = await prisma.commissionRule.upsert({
      where: {
        carrierId_fromCity_toCity: {
          carrierId: body.carrierId,
          fromCity,
          toCity,
        },
      },
      create: {
        carrierId: body.carrierId,
        fromCity,
        toCity,
        percent: body.percent,
      },
      update: { percent: body.percent },
    });
    return NextResponse.json({ rule }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
  }
}

/**
 * DELETE /api/admin/commissions?id=<ruleId>
 * Remove a route-specific rule (the carrier default applies afterwards).
 */
export async function DELETE(req: NextRequest) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "`id` is required" }, { status: 400 });
  }

  try {
    await prisma.commissionRule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }
}
