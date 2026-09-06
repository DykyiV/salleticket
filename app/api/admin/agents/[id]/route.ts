import { NextResponse, type NextRequest } from "next/server";
import { CommissionType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchBody = {
  commissionType?: CommissionType | null;
  commissionValue?: number | null;
  canAccessStaffTickets?: boolean;
  canAccessStaffTrips?: boolean;
  canMarkPayments?: boolean;
  canCancelTickets?: boolean;
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

  const data: Prisma.UserUpdateInput = {};

  // Commission fields are only touched when at least one is present in the
  // body — this endpoint also handles permission-only PATCHes from the
  // toggles on /admin/agents, which shouldn't require re-sending commission.
  const touchesCommission =
    "commissionType" in body || "commissionValue" in body;
  if (touchesCommission) {
    const clearing = body.commissionType == null && body.commissionValue == null;
    if (!clearing) {
      if (!body.commissionType || !["FIXED", "PERCENT"].includes(body.commissionType)) {
        return NextResponse.json(
          { error: "commissionType must be FIXED or PERCENT" },
          { status: 400 }
        );
      }
      if (
        typeof body.commissionValue !== "number" ||
        !Number.isFinite(body.commissionValue) ||
        body.commissionValue < 0
      ) {
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
    data.commissionType = clearing ? null : body.commissionType;
    data.commissionValue = clearing ? null : body.commissionValue;
  }

  if (body.canAccessStaffTickets !== undefined) {
    data.canAccessStaffTickets = Boolean(body.canAccessStaffTickets);
  }
  if (body.canAccessStaffTrips !== undefined) {
    data.canAccessStaffTrips = Boolean(body.canAccessStaffTrips);
  }
  if (body.canMarkPayments !== undefined) {
    data.canMarkPayments = Boolean(body.canMarkPayments);
  }
  if (body.canCancelTickets !== undefined) {
    data.canCancelTickets = Boolean(body.canCancelTickets);
  }

  try {
    const updated = await prisma.user.update({
      where: { id: params.id },
      data,
      select: {
        id: true,
        email: true,
        role: true,
        commissionType: true,
        commissionValue: true,
        canAccessStaffTickets: true,
        canAccessStaffTrips: true,
        canMarkPayments: true,
        canCancelTickets: true,
      },
    });
    return NextResponse.json({ user: updated });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    throw err;
  }
}
