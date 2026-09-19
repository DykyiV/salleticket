import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { destinationDistribution, soldOnAssignment, toAssignmentView } from "@/lib/ops/legs";
import { buildLayout, parseCoachLayout } from "@/lib/seats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

/** Operational structure of a departure: legs with buses and load. */
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;
  if (!(await can({ role: guard.session.role }, "route.read"))) {
    return NextResponse.json({ error: "Немає дозволу route.read" }, { status: 403 });
  }

  const departure = await prisma.departure.findUnique({
    where: { id: params.id },
    include: {
      stops: { orderBy: { sortOrder: "asc" } },
      legs: {
        orderBy: { order: "asc" },
        include: {
          assignments: {
            include: { bus: true, zones: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });
  if (!departure) {
    return NextResponse.json({ error: "Виїзд не знайдено" }, { status: 404 });
  }

  const legs = [];
  for (const leg of departure.legs) {
    const assignments = [];
    for (const row of leg.assignments) {
      const view = toAssignmentView(row);
      const sold = await soldOnAssignment(prisma, row.id);
      const distribution = await destinationDistribution(prisma, row.id);
      assignments.push({
        ...view,
        sold: sold.size,
        free: Math.max(0, view.capacity - sold.size),
        distribution,
      });
    }
    legs.push({
      id: leg.id,
      order: leg.order,
      label: leg.label,
      fromStopId: leg.fromStopId,
      toStopId: leg.toStopId,
      assignments,
    });
  }

  return NextResponse.json({
    departure: {
      id: departure.id,
      date: departure.date.toISOString().slice(0, 10),
      stops: departure.stops.map((s) => ({ id: s.id, city: s.city, sortOrder: s.sortOrder })),
    },
    legs,
  });
}

/** Add a leg to the departure (split at stops). */
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;
  if (!(await can({ role: guard.session.role }, "route.edit"))) {
    return NextResponse.json({ error: "Немає дозволу route.edit" }, { status: 403 });
  }

  let body: { label?: string; fromStopId?: string; toStopId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  if (!body.label?.trim()) {
    return NextResponse.json({ error: "Вкажіть назву плеча" }, { status: 400 });
  }

  const count = await prisma.leg.count({ where: { departureId: params.id } });
  const leg = await prisma.leg.create({
    data: {
      departureId: params.id,
      order: count + 1,
      label: body.label.trim(),
      fromStopId: body.fromStopId || null,
      toStopId: body.toStopId || null,
    },
  });
  return NextResponse.json({ leg }, { status: 201 });
}
