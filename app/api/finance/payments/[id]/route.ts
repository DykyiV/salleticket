import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DELETE /api/finance/payments/[id] — remove a payment entered by mistake. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission("finance.edit");
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const deleted = await prisma.counterpartyPayment.deleteMany({ where: { id } });
  if (deleted.count === 0) return NextResponse.json({ error: "Платіж не знайдено" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
