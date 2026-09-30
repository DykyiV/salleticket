import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Change how long a bus change before this leg takes. */
export async function PATCH(req: NextRequest, props: Params) {
  const params = await props.params;
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;
  if (!(await can({ role: guard.session.role }, "route.edit"))) {
    return NextResponse.json({ error: "Немає дозволу route.edit" }, { status: 403 });
  }
  let body: { transferMinutes?: number | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  const minutes = body.transferMinutes == null ? null : Number(body.transferMinutes);
  if (minutes != null && (!Number.isFinite(minutes) || minutes < 0 || minutes > 24 * 60)) {
    return NextResponse.json({ error: "Вкажіть час зміни автобуса в хвилинах" }, { status: 400 });
  }
  const leg = await prisma.leg.update({
    where: { id: params.id },
    data: { transferMinutes: minutes == null ? null : Math.round(minutes) },
  });
  return NextResponse.json({ leg });
}
