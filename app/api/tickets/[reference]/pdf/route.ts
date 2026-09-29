import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";
import { buildTicketsPdf, TICKET_PDF_INCLUDE } from "@/lib/tickets/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ reference: string }> };

/** Ticket PDF: booking number, QR code, route, passenger, price. */
export async function GET(req: NextRequest, props: Params) {
  const params = await props.params;
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  const booking = await prisma.booking.findUnique({
    where: { reference: params.reference },
    include: TICKET_PDF_INCLUDE,
  });
  if (!booking) {
    return NextResponse.json({ error: "Квиток не знайдено" }, { status: 404 });
  }
  if (
    booking.ticket.userId !== guard.session.sub &&
    !hasRoleAtLeast(guard.session.role, "AGENT")
  ) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const bytes = await buildTicketsPdf([booking], req.nextUrl.origin);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${booking.reference}.pdf"`,
    },
  });
}
