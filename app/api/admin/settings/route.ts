import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { getSiteSettings, updateSiteSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;
  return NextResponse.json({ settings: await getSiteSettings() });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;

  const settings = await updateSiteSettings({
    onlineDiscountPercent: num(body.onlineDiscountPercent),
    paymentSettleMinutes: num(body.paymentSettleMinutes),
    paymentDeadlineHours: num(body.paymentDeadlineHours),
    seatHoldMinutes: num(body.seatHoldMinutes),
  });
  return NextResponse.json({ settings });
}
