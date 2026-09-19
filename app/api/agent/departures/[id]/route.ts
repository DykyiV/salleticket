import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { canEditDepartures } from "@/lib/routes/permissions";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireRole("AGENT");
  if (!guard.ok) return guard.response;
  const user = await getCurrentUser();
  if (!user || !canEditDepartures(user)) {
    return NextResponse.json(
      { error: "Немає права редагувати виїзди" },
      { status: 403 }
    );
  }

  let body: { hasAssignedSeats?: boolean; allowSegmentSales?: boolean };
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
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Немає полів" }, { status: 400 });
  }

  try {
    const departure = await prisma.departure.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json({
      id: departure.id,
      hasAssignedSeats: departure.hasAssignedSeats,
      allowSegmentSales: departure.allowSegmentSales,
    });
  } catch {
    return NextResponse.json({ error: "Виїзд не знайдено" }, { status: 404 });
  }
}
