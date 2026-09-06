import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import {
  DiscountCardValidationError,
  parseUpdateDiscountCard,
} from "@/lib/admin/discountCards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

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
    const data = await parseUpdateDiscountCard(body as object);
    const card = await prisma.discountCard.update({
      where: { id: params.id },
      data,
      include: { user: { select: { id: true, email: true } } },
    });
    return NextResponse.json({ card });
  } catch (err) {
    if (err instanceof DiscountCardValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  try {
    await prisma.discountCard.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    throw err;
  }
}
