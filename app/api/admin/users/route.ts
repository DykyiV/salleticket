import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { ROLE_RANK } from "@/lib/auth/constants";
import { userChangeRefusal } from "@/lib/auth/userAdmin";
import {
  EmailTakenError,
  createUserWithTemporaryPassword,
  resetToTemporaryPassword,
} from "@/lib/auth/userAccounts";
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

const EMAIL_RE = /^\S+@\S+\.\S+$/;

type PostBody = { email?: string; role?: Role; userId?: string };

/**
 * POST { email, role } — adds a user; POST { userId } — gives a user a new
 * password. Mail is not connected yet, so the temporary password comes back
 * once in the response for the admin to pass on; the user then sets their
 * own in the cabinet profile. Same who-may-manage-whom rules as PATCH.
 */
export async function POST(req: NextRequest) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const actor = { id: guard.session.sub, role: guard.session.role };
  const superAdminCount = await prisma.user.count({ where: { role: "SUPER_ADMIN" } });
  const audit = (action: string, targetId: string, changes: Record<string, unknown>) =>
    recordAudit({
      actorId: guard.session.sub,
      actorEmail: guard.session.email,
      action,
      targetType: "user",
      targetId,
      changes,
      ipAddress: requestMeta(req).ipAddress,
    });

  if (body.userId) {
    const target = await prisma.user.findUnique({ where: { id: body.userId }, select: userSelect });
    if (!target) {
      return NextResponse.json({ error: "Користувача не знайдено" }, { status: 404 });
    }
    const refusal = userChangeRefusal({ actor, target, superAdminCount });
    if (refusal) return NextResponse.json({ error: refusal }, { status: 403 });
    const { password } = await resetToTemporaryPassword(target.id);
    await audit("user.password", target.id, { email: target.email });
    return NextResponse.json({ user: target, password });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return NextResponse.json({ error: "Вкажіть коректний e-mail" }, { status: 400 });
  }
  const role = body.role ?? "CUSTOMER";
  if (!(role in ROLE_RANK)) {
    return NextResponse.json({ error: "Unknown role" }, { status: 400 });
  }
  const refusal = userChangeRefusal({
    actor,
    target: { id: "", role: "CUSTOMER" },
    newRole: role,
    superAdminCount,
  });
  if (refusal) return NextResponse.json({ error: refusal }, { status: 403 });
  try {
    const { id, password } = await createUserWithTemporaryPassword(email, role);
    await audit("user.create", id, { email, role });
    const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
    return NextResponse.json({ user, password }, { status: 201 });
  } catch (err) {
    if (err instanceof EmailTakenError) {
      return NextResponse.json(
        { error: "Користувач з таким e-mail уже є. Знайдіть його в списку й натисніть «Новий пароль»." },
        { status: 409 }
      );
    }
    throw err;
  }
}
