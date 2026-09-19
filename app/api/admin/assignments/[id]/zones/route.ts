import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;
  if (!(await can({ role: guard.session.role }, "route.edit"))) {
    return NextResponse.json({ error: "Немає дозволу route.edit" }, { status: 403 });
  }

  let body: { name?: string; fromSeat?: number; toSeat?: number; groupLabel?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  if (!body.name?.trim() || !body.fromSeat || !body.toSeat || body.toSeat < body.fromSeat) {
    return NextResponse.json(
      { error: "Вкажіть назву зони і діапазон місць (з … по …)" },
      { status: 400 }
    );
  }

  const zone = await prisma.seatZone.create({
    data: {
      assignmentId: params.id,
      name: body.name.trim(),
      fromSeat: body.fromSeat,
      toSeat: body.toSeat,
      groupLabel: body.groupLabel?.trim() || null,
    },
  });
  return NextResponse.json({ zone }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;
  if (!(await can({ role: guard.session.role }, "route.edit"))) {
    return NextResponse.json({ error: "Немає дозволу route.edit" }, { status: 403 });
  }
  let body: { zoneId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  if (!body.zoneId) {
    return NextResponse.json({ error: "Вкажіть зону" }, { status: 400 });
  }
  await prisma.seatZone.deleteMany({
    where: { id: body.zoneId, assignmentId: params.id },
  });
  return NextResponse.json({ ok: true });
}
