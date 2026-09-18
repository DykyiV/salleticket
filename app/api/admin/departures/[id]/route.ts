import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { canEditDepartures } from "@/lib/routes/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { notifyScheduleChanged } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;
  const user = await getCurrentUser();
  if (!user || !canEditDepartures(user)) {
    return NextResponse.json(
      { error: "Немає права редагувати виїзди" },
      { status: 403 }
    );
  }

  let body: {
    hasAssignedSeats?: boolean;
    allowSegmentSales?: boolean;
    busId?: string | null;
    defaultBus?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.hasAssignedSeats === "boolean") {
    data.hasAssignedSeats = body.hasAssignedSeats;
  }
  if (typeof body.allowSegmentSales === "boolean") {
    data.allowSegmentSales = body.allowSegmentSales;
  }
  if (body.busId !== undefined) {
    if (body.busId === null) {
      data.busId = null;
    } else {
      const bus = await prisma.bus.findUnique({ where: { id: body.busId } });
      if (!bus) {
        return NextResponse.json({ error: "Автобус не знайдено" }, { status: 404 });
      }
      data.busId = bus.id;
      data.defaultBus = `${bus.model ?? "Автобус"} ${bus.plate}`.trim();
    }
  }
  if (typeof body.defaultBus === "string") {
    data.defaultBus = body.defaultBus;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Немає полів для оновлення" }, { status: 400 });
  }

  try {
    const departure = await prisma.departure.update({
      where: { id: params.id },
      data,
      include: { template: { select: { name: true } } },
    });
    if (data.defaultBus || data.busId !== undefined) {
      await notifyScheduleChanged(
        `${departure.template.name} · ${departure.date.toISOString().slice(0, 10)} — призначено автобус ${departure.defaultBus ?? ""}`
      );
    }
    return NextResponse.json({
      id: departure.id,
      hasAssignedSeats: departure.hasAssignedSeats,
      allowSegmentSales: departure.allowSegmentSales,
      busId: departure.busId,
    });
  } catch {
    return NextResponse.json({ error: "Виїзд не знайдено" }, { status: 404 });
  }
}
