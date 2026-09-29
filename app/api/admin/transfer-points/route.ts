import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;
  if (!hasRoleAtLeast(guard.session.role, "AGENT")) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }
  const points = await prisma.transferPoint.findMany({
    orderBy: { city: "asc" },
  });
  return NextResponse.json({ points });
}

export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;
  if (!(await can({ role: guard.session.role }, "route.edit"))) {
    return NextResponse.json({ error: "Немає дозволу route.edit" }, { status: 403 });
  }

  let body: {
    name?: string;
    city?: string;
    location?: string;
    description?: string;
    defaultTransferTime?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  if (!body.name?.trim() || !body.city?.trim()) {
    return NextResponse.json({ error: "Вкажіть назву і місто" }, { status: 400 });
  }
  const point = await prisma.transferPoint.create({
    data: {
      name: body.name.trim(),
      city: body.city.trim(),
      location: body.location?.trim() || null,
      description: body.description?.trim() || null,
      defaultTransferTime: body.defaultTransferTime ?? 45,
    },
  });
  return NextResponse.json({ point }, { status: 201 });
}
