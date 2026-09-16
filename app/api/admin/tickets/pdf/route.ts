import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { buildTicketsPdf, toTicketPdfData } from "@/lib/tickets/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IDS = 100;

/**
 * GET /api/admin/tickets/pdf?ids=id1,id2,… — ADMIN-only bulk print: one PDF
 * with one page per requested ticket, in the requested order. Unknown ids are
 * skipped; if none resolve, 404.
 */
export async function GET(req: NextRequest) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const idsParam = req.nextUrl.searchParams.get("ids") ?? "";
  const ids = [...new Set(idsParam.split(",").map((s) => s.trim()).filter(Boolean))];

  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Provide at least one ticket id in `ids`" },
      { status: 400 }
    );
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json(
      { error: `Too many ids — max ${MAX_IDS} per PDF` },
      { status: 400 }
    );
  }

  const tickets = await prisma.ticket.findMany({
    where: { id: { in: ids } },
    include: {
      booking: true,
      user: { select: { email: true } },
      trip: { include: { carrier: true } },
    },
  });
  if (tickets.length === 0) {
    return NextResponse.json({ error: "No tickets found" }, { status: 404 });
  }

  // Preserve the requested order.
  const byId = new Map(tickets.map((t) => [t.id, t]));
  const ordered = ids
    .map((id) => byId.get(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const pdf = await buildTicketsPdf(ordered.map(toTicketPdfData));

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="tickets-${ordered.length}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
