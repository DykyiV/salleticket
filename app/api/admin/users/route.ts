import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { ROLE_RANK } from "@/lib/auth/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ users });
}

type PatchBody = {
  userId?: string;
  role?: Role;
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

  if (!body.userId || !body.role) {
    return NextResponse.json(
      { error: "`userId` and `role` are required" },
      { status: 400 }
    );
  }
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

  const updated = await prisma.user.update({
    where: { id: body.userId },
    data: { role: body.role },
    select: { id: true, email: true, role: true, createdAt: true },
  });
  return NextResponse.json({ user: updated });
}
