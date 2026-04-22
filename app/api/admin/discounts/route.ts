import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import {
  DiscountValidationError,
  parseCreateDiscount,
} from "@/lib/admin/discounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const discounts = await prisma.promo.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, email: true } } },
  });

  return NextResponse.json({ discounts });
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
    const data = await parseCreateDiscount(prisma, body as object);
    const discount = await prisma.promo.create({
      data,
      include: { user: { select: { id: true, email: true } } },
    });
    return NextResponse.json({ discount }, { status: 201 });
  } catch (err) {
    if (err instanceof DiscountValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A discount with this code already exists" },
        { status: 409 }
      );
    }
    throw err;
  }
}
