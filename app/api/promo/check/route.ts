import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { PromoError, validatePromo } from "@/lib/promo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live promo-code check for the booking form. Runs the same rule set as
 * POST /api/booking without incrementing usedCount.
 *
 *   GET /api/promo/check?code=DISCOUNT10
 *
 *   200 { ok: true,  promo: { code, percent, label } }
 *   200 { ok: false, reason, message }
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code") ?? "";
  if (!code.trim()) {
    return NextResponse.json({ ok: false, reason: "missing", message: "Empty code" });
  }

  const session = await getSession();

  try {
    const promo = await validatePromo(prisma, {
      rawCode: code,
      currentUserId: session?.sub ?? null,
    });
    return NextResponse.json({
      ok: true,
      promo: {
        code: promo.code,
        type: promo.type,
        percent: promo.percent,
        amount: promo.amount,
        label: promo.label,
      },
    });
  } catch (err) {
    if (err instanceof PromoError) {
      return NextResponse.json({
        ok: false,
        reason: err.reason,
        message: err.message,
      });
    }
    throw err;
  }
}
