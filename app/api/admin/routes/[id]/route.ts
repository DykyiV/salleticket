import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { RouteValidationError, parseUpdateRoute } from "@/lib/routes/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const route = await prisma.route.findUnique({
    where: { id: params.id },
    include: {
      carrier: { select: { id: true, name: true } },
      stops: { orderBy: { order: "asc" } },
    },
  });
  if (!route) return NextResponse.json({ error: "Route not found" }, { status: 404 });
  return NextResponse.json({ route });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const { data, stops } = await parseUpdateRoute(prisma, body as object);

    // Stops are replaced wholesale when supplied (simpler and safer than a
    // partial diff — the admin UI always sends the full ordered list).
    const route = await prisma.$transaction(async (tx) => {
      if (stops !== undefined) {
        await tx.routeStop.deleteMany({ where: { routeId: params.id } });
      }
      return tx.route.update({
        where: { id: params.id },
        data: {
          ...data,
          ...(stops !== undefined ? { stops: { create: stops } } : {}),
        },
        include: {
          carrier: { select: { id: true, name: true } },
          stops: { orderBy: { order: "asc" } },
        },
      });
    });

    return NextResponse.json({ route });
  } catch (err) {
    if (err instanceof RouteValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Route not found" }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  try {
    await prisma.route.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Route not found" }, { status: 404 });
    }
    throw err;
  }
}
