import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";
import { buildTicketsPdf, toTicketPdfData } from "@/lib/tickets/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tickets/[id]/pdf — download the e-ticket as a PDF.
 * Visible to whoever can see the ticket: the owner, users with the
 * admin-granted `canViewAllTickets` flag, and admins.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      booking: true,
      user: { select: { email: true } },
      trip: { include: { carrier: true } },
    },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const isAdmin = hasRoleAtLeast(guard.session.role, "ADMIN");
  const isOwner = ticket.userId === guard.session.sub;
  let canViewAll = false;
  if (!isAdmin && !isOwner) {
    const user = await prisma.user.findUnique({
      where: { id: guard.session.sub },
      select: { canViewAllTickets: true },
    });
    canViewAll = user?.canViewAllTickets ?? false;
  }
  if (!isAdmin && !isOwner && !canViewAll) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pdf = await buildTicketsPdf([toTicketPdfData(ticket)]);
  const reference = ticket.booking?.reference ?? ticket.id.slice(-8);

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="ticket-${reference}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
