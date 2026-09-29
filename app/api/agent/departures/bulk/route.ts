import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { applyDepartureBulk } from "@/lib/routes/applyBulk";
import type { BulkPayload } from "@/lib/routes/bulk";
import {
  canEditDepartures,
  canHideSeats,
  canHideStops,
} from "@/lib/routes/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const guard = await requireRole("AGENT");
  if (!guard.ok) return guard.response;

  const user = await prisma.user.findUnique({
    where: { id: guard.session.sub },
    select: {
      role: true,
      canEditDepartures: true,
      canHideStops: true,
      canHideSeats: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  let body: BulkPayload;
  try {
    body = (await req.json()) as BulkPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    (body.action === "hideStops" || body.action === "showStops") &&
    !canHideStops(user)
  ) {
    return NextResponse.json(
      { error: "Адмін не надав право приховувати / показувати міста" },
      { status: 403 }
    );
  }
  if (body.action === "setSaleEnabled" && !canHideSeats(user)) {
    return NextResponse.json(
      { error: "Адмін не надав право приховувати місця для продажу" },
      { status: 403 }
    );
  }
  if (body.action === "setStopTime" && !canEditDepartures(user)) {
    return NextResponse.json(
      { error: "Адмін не надав право редагувати години виїзду" },
      { status: 403 }
    );
  }

  try {
    const result = await applyDepartureBulk(body);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bulk update failed" },
      { status: 400 }
    );
  }
}
