import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { parseOptionalText, parseRequiredText, RouteValidationError } from "@/lib/routes/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const countries = await prisma.country.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { templates: true } } },
  });
  return NextResponse.json({
    countries: countries.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      sortOrder: c.sortOrder,
      templateCount: c._count.templates,
    })),
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const name = parseRequiredText(body.name, "Назва країни");
    const code = parseOptionalText(body.code)?.toUpperCase() ?? null;
    const country = await prisma.country.create({
      data: {
        name,
        code,
        sortOrder: Number.isInteger(Number(body.sortOrder))
          ? Number(body.sortOrder)
          : 0,
      },
    });
    return NextResponse.json({ country }, { status: 201 });
  } catch (err) {
    if (err instanceof RouteValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create country" },
      { status: 400 }
    );
  }
}
