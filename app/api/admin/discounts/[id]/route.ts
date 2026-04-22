import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import {
  DiscountValidationError,
  parseUpdateDiscount,
} from "@/lib/admin/discounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const discount = await prisma.promo.findUnique({
    where: { id: params.id },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!discount) {
    return NextResponse.json({ error: "Discount not found" }, { status: 404 });
  }
  return NextResponse.json({ discount });
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
    const data = await parseUpdateDiscount(prisma, body as object);
    const discount = await prisma.promo.update({
      where: { id: params.id },
      data,
      include: { user: { select: { id: true, email: true } } },
    });
    return NextResponse.json({ discount });
  } catch (err) {
    if (err instanceof DiscountValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return NextResponse.json(
          { error: "A discount with this code already exists" },
          { status: 409 }
        );
      }
      if (err.code === "P2025") {
        return NextResponse.json(
          { error: "Discount not found" },
          { status: 404 }
        );
      }
    }
    throw err;
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  try {
    await prisma.promo.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Discount not found" },
        { status: 404 }
      );
    }
    throw err;
  }
}
