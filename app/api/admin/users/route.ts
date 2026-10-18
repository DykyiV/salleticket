import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { ROLE_RANK } from "@/lib/auth/constants";
import { userChangeRefusal } from "@/lib/auth/userAdmin";
import { recordAudit } from "@/lib/audit";
import { requestMeta } from "@/lib/tickets/history";

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

  const target = await prisma.user.findUnique({
    where: { id: body.userId },
    select: userSelect,
  });
  if (!target) {
    return NextResponse.json({ error: "Користувача не знайдено" }, { status: 404 });
  }
  const refusal = userChangeRefusal({
    actor: { id: guard.session.sub, role: guard.session.role },
    target: { id: target.id, role: target.role },
    newRole: data.role,
    superAdminCount: await prisma.user.count({ where: { role: "SUPER_ADMIN" } }),
  });
  if (refusal) return NextResponse.json({ error: refusal }, { status: 403 });

  const roleChanged = data.role !== undefined && data.role !== target.role;
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(data) as (keyof typeof data)[]) {
    if (data[key] !== target[key]) changes[key] = { from: target[key], to: data[key] };
  }

  const updated = await prisma.user.update({
    where: { id: body.userId },
    data: {
      ...data,
      // A role change signs the user out everywhere: the new role applies
      // from their next login, the old one stops working right now.
      ...(roleChanged ? { sessionVersion: { increment: 1 } } : {}),
    },
    select: userSelect,
  });
  if (Object.keys(changes).length) {
    await recordAudit({
      actorId: guard.session.sub,
      actorEmail: guard.session.email,
      action: roleChanged ? "user.role" : "user.flags",
      targetType: "user",
      targetId: target.id,
      changes: { email: target.email, ...changes },
      ipAddress: requestMeta(req).ipAddress,
    });
  }
  return NextResponse.json({ user: updated });
}
