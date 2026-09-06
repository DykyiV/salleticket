import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { RouteValidationError, parseCreateRoute } from "@/lib/routes/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const routes = await prisma.route.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      carrier: { select: { id: true, name: true } },
      stops: { orderBy: { order: "asc" } },
    },
  });
  return NextResponse.json({ routes });
}

export async function POST(req: NextRequest) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const { data, stops } = await parseCreateRoute(prisma, body as object);
    const route = await prisma.route.create({
      data: { ...data, stops: { create: stops } },
      include: {
        carrier: { select: { id: true, name: true } },
        stops: { orderBy: { order: "asc" } },
      },
    });
    return NextResponse.json({ route }, { status: 201 });
  } catch (err) {
    if (err instanceof RouteValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "A route with conflicting unique data already exists" },
        { status: 409 }
      );
    }
    throw err;
  }
}
