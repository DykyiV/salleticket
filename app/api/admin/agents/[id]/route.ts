import { NextResponse, type NextRequest } from "next/server";
import { CommissionType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchBody = {
  commissionType?: CommissionType | null;
  commissionValue?: number | null;
};

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Clearing the commission (both null) is always allowed. Setting one
  // requires both fields — a type without a value (or vice versa) is
  // meaningless.
  const clearing = body.commissionType == null && body.commissionValue == null;
  if (!clearing) {
    if (!body.commissionType || !["FIXED", "PERCENT"].includes(body.commissionType)) {
      return NextResponse.json(
        { error: "commissionType must be FIXED or PERCENT" },
        { status: 400 }
      );
    }
    if (typeof body.commissionValue !== "number" || !Number.isFinite(body.commissionValue) || body.commissionValue < 0) {
      return NextResponse.json(
        { error: "commissionValue must be a non-negative number" },
        { status: 400 }
      );
    }
    if (body.commissionType === "PERCENT" && body.commissionValue > 1) {
      return NextResponse.json(
        { error: "commissionValue for PERCENT must be a fraction 0..1 (e.g. 0.1 for 10%)" },
        { status: 400 }
      );
    }
  }

  try {
    const updated = await prisma.user.update({
      where: { id: params.id },
      data: {
        commissionType: clearing ? null : body.commissionType,
        commissionValue: clearing ? null : body.commissionValue,
      },
      select: { id: true, email: true, role: true, commissionType: true, commissionValue: true },
    });
    return NextResponse.json({ user: updated });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    throw err;
  }
}
