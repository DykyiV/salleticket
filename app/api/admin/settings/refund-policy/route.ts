import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { getRefundPolicy, setRefundPolicy } from "@/lib/refundPolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const policy = await getRefundPolicy(prisma);
  return NextResponse.json({ policy });
}

type PatchBody = {
  cashRefundPercent?: number;
  onlineRefundPercent?: number;
};

function parsePercent(input: unknown, field: string): number {
  const n = typeof input === "number" ? input : Number.parseFloat(String(input));
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new Error(`${field} must be a fraction between 0 and 1 (e.g. 0.8 for 80%)`);
  }
  return n;
}

export async function PATCH(req: NextRequest) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const current = await getRefundPolicy(prisma);
  try {
    const next = {
      cashRefundPercent:
        body.cashRefundPercent !== undefined
          ? parsePercent(body.cashRefundPercent, "cashRefundPercent")
          : current.cashRefundPercent,
      onlineRefundPercent:
        body.onlineRefundPercent !== undefined
          ? parsePercent(body.onlineRefundPercent, "onlineRefundPercent")
          : current.onlineRefundPercent,
    };
    const saved = await setRefundPolicy(prisma, next);
    return NextResponse.json({ policy: saved });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid input" },
      { status: 400 }
    );
  }
}
