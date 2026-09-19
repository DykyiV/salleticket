import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { swapAssignmentBus, SwapCapacityError } from "@/lib/ops/swap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

/** Quick bus swap: allowed when the new capacity covers booked passengers. */
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;
  if (!(await can({ role: guard.session.role }, "route.edit"))) {
    return NextResponse.json({ error: "Немає дозволу route.edit" }, { status: 403 });
  }

  let body: { newBusId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  if (!body.newBusId) {
    return NextResponse.json({ error: "Вкажіть новий автобус" }, { status: 400 });
  }

  try {
    const result = await swapAssignmentBus({
      assignmentId: params.id,
      newBusId: body.newBusId,
      changedBy: guard.session.sub,
    });
    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof SwapCapacityError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Не вдалося замінити автобус" },
      { status: 500 }
    );
  }
}
