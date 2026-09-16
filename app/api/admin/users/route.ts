import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { ROLE_RANK } from "@/lib/auth/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USER_SELECT = {
  id: true,
  email: true,
  role: true,
  canViewAllTickets: true,
  canEditAllTickets: true,
  createdAt: true,
} as const;

export async function GET() {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const users = await prisma.user.findMany({
    select: USER_SELECT,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ users });
}

type PatchBody = {
  userId?: string;
  role?: Role;
  canViewAllTickets?: boolean;
  canEditAllTickets?: boolean;
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
    return NextResponse.json(
      { error: "`userId` is required" },
      { status: 400 }
    );
  }
  if (
    body.role === undefined &&
    body.canViewAllTickets === undefined &&
    body.canEditAllTickets === undefined
  ) {
    return NextResponse.json(
      { error: "Provide `role`, `canViewAllTickets` and/or `canEditAllTickets`" },
      { status: 400 }
    );
  }

  const data: {
    role?: Role;
    canViewAllTickets?: boolean;
    canEditAllTickets?: boolean;
  } = {};

  if (body.role !== undefined) {
    if (!(body.role in ROLE_RANK)) {
      return NextResponse.json({ error: "Unknown role" }, { status: 400 });
    }
    // Only SUPER_ADMIN may assign ADMIN or SUPER_ADMIN roles.
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

  // The "view all passengers' tickets" permission is meaningful for agents;
  // any ADMIN may grant or revoke it.
  if (body.canViewAllTickets !== undefined) {
    data.canViewAllTickets = Boolean(body.canViewAllTickets);
  }

  // The "edit any ticket's passenger details" permission; any ADMIN may
  // grant or revoke it. Owners can always edit their own passenger data.
  if (body.canEditAllTickets !== undefined) {
    data.canEditAllTickets = Boolean(body.canEditAllTickets);
  }

  try {
    const updated = await prisma.user.update({
      where: { id: body.userId },
      data,
      select: USER_SELECT,
    });
    return NextResponse.json({ user: updated });
  } catch {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
}
