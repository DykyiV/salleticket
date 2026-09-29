import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { buildTicketsPdf, TICKET_PDF_INCLUDE } from "@/lib/tickets/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IDS = 100;

/**
 * GET /api/tickets/bulk-pdf?ids=id1,id2,… — staff bulk print: one PDF with
 * one page per requested ticket (same layout as the single-ticket download),
 * in the requested order. Unknown ids are skipped; if none resolve, 404.
 *
 * AGENT and above — the same audience that can list every ticket in
 * /cabinet/tickets and download any single ticket PDF.
 */
export async function GET(req: NextRequest) {
  const guard = await requireRole("AGENT");
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

  const bookings = await prisma.booking.findMany({
    where: { ticketId: { in: ids } },
    include: TICKET_PDF_INCLUDE,
  });
  if (bookings.length === 0) {
    return NextResponse.json({ error: "No tickets found" }, { status: 404 });
  }

  // Preserve the requested order.
  const byTicket = new Map(bookings.map((b) => [b.ticketId, b]));
  const ordered = ids
    .map((id) => byTicket.get(id))
    .filter((b): b is NonNullable<typeof b> => Boolean(b));

  const bytes = await buildTicketsPdf(ordered, req.nextUrl.origin);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="tickets-${ordered.length}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
