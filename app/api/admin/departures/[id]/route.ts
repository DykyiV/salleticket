import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { canEditDepartures } from "@/lib/routes/permissions";
import { getCurrentUser } from "@/lib/auth/session";

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

  let body: { hasAssignedSeats?: boolean };
  try {
    body = (await req.json()) as { hasAssignedSeats?: boolean };
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  if (typeof body.hasAssignedSeats !== "boolean") {
    return NextResponse.json({ error: "Вкажіть hasAssignedSeats" }, { status: 400 });
  }

  try {
    const departure = await prisma.departure.update({
      where: { id: params.id },
      data: { hasAssignedSeats: body.hasAssignedSeats },
    });
    return NextResponse.json({
      id: departure.id,
      hasAssignedSeats: departure.hasAssignedSeats,
    });
  } catch {
    return NextResponse.json({ error: "Виїзд не знайдено" }, { status: 404 });
  }
}
