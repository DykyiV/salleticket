import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  seedRolePermissions,
} from "@/lib/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;
  await seedRolePermissions();
  const rows = await prisma.rolePermission.findMany();
  return NextResponse.json({
    roles: Object.keys(Role),
    permissions: PERMISSIONS,
    grants: rows.map((r) => ({
      role: r.role,
      permission: r.permission,
      allowed: r.allowed,
    })),
    defaults: DEFAULT_ROLE_PERMISSIONS,
  });
}

export async function PUT(req: NextRequest) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  let body: { role?: Role; permission?: string; allowed?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  if (
    !body.role ||
    !(body.role in Role) ||
    !body.permission ||
    !PERMISSIONS.includes(body.permission as never) ||
    typeof body.allowed !== "boolean"
  ) {
    return NextResponse.json({ error: "Некоректні дані" }, { status: 400 });
  }
  if (body.role === "ADMIN" || body.role === "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Адмінські ролі мають усі дозволи" },
      { status: 400 }
    );
  }

  const grant = await prisma.rolePermission.upsert({
    where: {
      role_permission: { role: body.role, permission: body.permission },
    },
    create: {
      role: body.role,
      permission: body.permission,
      allowed: body.allowed,
    },
    update: { allowed: body.allowed },
  });
  return NextResponse.json({ grant });
}
