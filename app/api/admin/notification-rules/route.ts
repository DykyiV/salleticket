import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  let body: {
    kind?: string;
    enabled?: boolean;
    roles?: Role[];
    thresholdMin?: number | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  if (!body.kind) {
    return NextResponse.json({ error: "Вкажіть kind" }, { status: 400 });
  }
  const roles = (body.roles ?? []).filter((r) => r in Role);

  const rule = await prisma.notificationRule.upsert({
    where: { kind: body.kind },
    create: {
      kind: body.kind,
      enabled: body.enabled !== false,
      roles: JSON.stringify(roles),
      thresholdMin: body.thresholdMin ?? null,
    },
    update: {
      enabled: body.enabled !== false,
      roles: JSON.stringify(roles),
      thresholdMin: body.thresholdMin ?? null,
    },
  });
  return NextResponse.json({ rule });
}
