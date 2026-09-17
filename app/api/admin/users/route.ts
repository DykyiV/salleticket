import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { ROLE_RANK } from "@/lib/auth/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const userSelect = {
  id: true,
  email: true,
  role: true,
  canEditDepartures: true,
  canHideStops: true,
  canHideSeats: true,
  createdAt: true,
} as const;

export async function GET() {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const users = await prisma.user.findMany({
    select: userSelect,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ users });
}

type PatchBody = {
  userId?: string;
  role?: Role;
  canEditDepartures?: boolean;
  canHideStops?: boolean;
  canHideSeats?: boolean;
};

export async function PATCH(req: NextRequest) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.userId) {
    return NextResponse.json({ error: "`userId` is required" }, { status: 400 });
  }

  const data: {
    role?: Role;
    canEditDepartures?: boolean;
    canHideStops?: boolean;
    canHideSeats?: boolean;
  } = {};

  if (body.role) {
    if (!(body.role in ROLE_RANK)) {
      return NextResponse.json({ error: "Unknown role" }, { status: 400 });
    }
    if (
      (body.role === "ADMIN" || body.role === "SUPER_ADMIN") &&
      guard.session.role !== "SUPER_ADMIN"
    ) {
      return NextResponse.json(
        { error: "Only SUPER_ADMIN can assign ADMIN / SUPER_ADMIN roles" },
        { status: 403 }
      );
    }
    data.role = body.role;
  }

  if (typeof body.canEditDepartures === "boolean") {
    data.canEditDepartures = body.canEditDepartures;
  }
  if (typeof body.canHideStops === "boolean") {
    data.canHideStops = body.canHideStops;
  }
  if (typeof body.canHideSeats === "boolean") {
    data.canHideSeats = body.canHideSeats;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: body.userId },
    data,
    select: userSelect,
  });
  return NextResponse.json({ user: updated });
}
