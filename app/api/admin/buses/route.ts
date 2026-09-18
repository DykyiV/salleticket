import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { buildLayout, parseCoachLayout, type CoachLayoutJSON } from "@/lib/seats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireRole("AGENT");
  if (!guard.ok) return guard.response;
  const buses = await prisma.bus.findMany({ orderBy: { plate: "asc" } });
  return NextResponse.json({
    buses: buses.map((bus) => {
      const layout = parseCoachLayout(bus.layout);
      return {
        id: bus.id,
        plate: bus.plate,
        model: bus.model,
        decks: bus.decks,
        isActive: bus.isActive,
        seatCount: buildLayout(layout).seatCount,
        layout,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  let body: { plate?: string; model?: string; layout?: CoachLayoutJSON };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  const plate = body.plate?.trim();
  if (!plate) {
    return NextResponse.json({ error: "Вкажіть номерний знак" }, { status: 400 });
  }
  const layout = body.layout ?? parseCoachLayout("");
  const decks = layout.decks.length;

  try {
    const bus = await prisma.bus.create({
      data: {
        plate,
        model: body.model?.trim() || null,
        decks,
        layout: JSON.stringify(layout),
      },
    });
    return NextResponse.json({ bus }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Автобус з таким номером уже є" },
      { status: 409 }
    );
  }
}
