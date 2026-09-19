import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { parseCoachLayout, type CoachLayoutJSON } from "@/lib/seats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  let body: {
    plate?: string;
    model?: string;
    isActive?: boolean;
    layout?: CoachLayoutJSON;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.plate?.trim()) data.plate = body.plate.trim();
  if (body.model !== undefined) data.model = body.model?.trim() || null;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.layout) {
    const layout = parseCoachLayout(JSON.stringify(body.layout));
    data.layout = JSON.stringify(layout);
    data.decks = layout.decks.length;
  }

  try {
    const bus = await prisma.bus.update({ where: { id: params.id }, data });
    return NextResponse.json({ bus });
  } catch {
    return NextResponse.json({ error: "Автобус не знайдено" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;
  const used = await prisma.departure.count({ where: { busId: params.id } });
  if (used > 0) {
    await prisma.bus.update({
      where: { id: params.id },
      data: { isActive: false },
    });
    return NextResponse.json({ ok: true, deactivated: true });
  }
  await prisma.bus.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
