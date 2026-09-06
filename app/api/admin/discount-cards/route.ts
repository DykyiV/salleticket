import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import {
  DiscountCardValidationError,
  parseCreateDiscountCard,
} from "@/lib/admin/discountCards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const cards = await prisma.discountCard.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, email: true } } },
  });
  return NextResponse.json({ cards });
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
    const data = await parseCreateDiscountCard(prisma, body as object);
    const card = await prisma.discountCard.create({
      data,
      include: { user: { select: { id: true, email: true } } },
    });
    return NextResponse.json({ card }, { status: 201 });
  } catch (err) {
    if (err instanceof DiscountCardValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "Code collision, try again" }, { status: 409 });
    }
    throw err;
  }
}
