import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Non-sensitive sales settings shown on the booking form. */
export async function GET() {
  const settings = await getSiteSettings();
  return NextResponse.json({
    onlineDiscountPercent: settings.onlineDiscountPercent,
    paymentDeadlineHours: settings.paymentDeadlineHours,
    paymentSettleMinutes: settings.paymentSettleMinutes,
  });
}
