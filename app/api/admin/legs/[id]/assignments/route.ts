import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

/** Add a second (third…) bus to the same leg. */
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;
  if (!(await can({ role: guard.session.role }, "route.edit"))) {
    return NextResponse.json({ error: "Немає дозволу route.edit" }, { status: 403 });
  }

  let body: { busId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  if (!body.busId) {
    return NextResponse.json({ error: "Вкажіть автобус" }, { status: 400 });
  }
  const bus = await prisma.bus.findUnique({ where: { id: body.busId } });
  if (!bus) {
    return NextResponse.json({ error: "Автобус не знайдено" }, { status: 404 });
  }

  const assignment = await prisma.vehicleAssignment.create({
    data: { legId: params.id, busId: bus.id },
    include: { bus: true },
  });
  return NextResponse.json(
    {
      assignment: {
        id: assignment.id,
        busId: bus.id,
        busPlate: bus.plate,
        busModel: bus.model,
      },
    },
    { status: 201 }
  );
}
