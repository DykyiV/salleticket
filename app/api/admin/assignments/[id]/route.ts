import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { swapAssignmentBus, SwapCapacityError } from "@/lib/ops/swap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

/** Edit assignment flags: direct, cross-zone sales, active. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;
  if (!(await can({ role: guard.session.role }, "route.edit"))) {
    return NextResponse.json({ error: "Немає дозволу route.edit" }, { status: 403 });
  }

  let body: {
    isDirect?: boolean;
    directDestinationCity?: string | null;
    allowCrossZoneSales?: boolean;
    active?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.isDirect === "boolean") data.isDirect = body.isDirect;
  if (body.directDestinationCity !== undefined) {
    data.directDestinationCity = body.directDestinationCity?.trim() || null;
  }
  if (typeof body.allowCrossZoneSales === "boolean") {
    data.allowCrossZoneSales = body.allowCrossZoneSales;
  }
  if (typeof body.active === "boolean") data.active = body.active;
  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Немає полів" }, { status: 400 });
  }

  try {
    const assignment = await prisma.vehicleAssignment.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json({ assignment });
  } catch {
    return NextResponse.json({ error: "Призначення не знайдено" }, { status: 404 });
  }
}

/** Deactivate (never hard-delete assignments with bookings). */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;
  if (!(await can({ role: guard.session.role }, "route.edit"))) {
    return NextResponse.json({ error: "Немає дозволу route.edit" }, { status: 403 });
  }
  const sold = await prisma.ticketLeg.count({
    where: {
      assignmentId: params.id,
      ticket: { status: { in: ["RESERVED", "AWAITING_PAYMENT", "PAID_ONLINE", "PAID_CASH"] } },
    },
  });
  if (sold > 0) {
    return NextResponse.json(
      { error: `На цьому автобусі ${sold} активних бронювань — спочатку замініть автобус` },
      { status: 409 }
    );
  }
  await prisma.vehicleAssignment.update({
    where: { id: params.id },
    data: { active: false },
  });
  return NextResponse.json({ ok: true });
}
