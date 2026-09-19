import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { priceForTrip } from "@/lib/pricing/grid";
import { recordTicketHistory, requestMeta } from "@/lib/tickets/history";
import { updateTicketVersioned } from "@/lib/tickets/version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

/** SUPER_ADMIN: reprice the ticket at the current tariff grid. */
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireRole("SUPER_ADMIN");
  if (!guard.ok) return guard.response;

  const ticket = await prisma.ticket.findUnique({
    where: { id: params.id },
    include: { trip: true, returnTrip: true, booking: true },
  });
  if (!ticket || !ticket.trip) {
    return NextResponse.json({ error: "Квиток не знайдено" }, { status: 404 });
  }

  const outbound = await priceForTrip(prisma, ticket.trip);
  const returnLeg = ticket.returnTrip
    ? await priceForTrip(prisma, ticket.returnTrip)
    : { price: 0 };
  const nextPrice = Math.round((outbound.price + returnLeg.price) * 100) / 100;

  const updated = await updateTicketVersioned(prisma, ticket.id, ticket.version, {
    finalPrice: nextPrice,
    basePrice: nextPrice,
  });
  if (ticket.booking) {
    await prisma.booking.update({
      where: { id: ticket.booking.id },
      data: { finalPrice: nextPrice },
    });
  }
  await recordTicketHistory(prisma, {
    ticketId: ticket.id,
    action: "PRICE_RECALCED",
    source: "ADMIN_PANEL",
    changedBy: guard.session.sub,
    request: requestMeta(req),
    changes: {
      finalPrice: { from: ticket.finalPrice, to: nextPrice },
    },
  });

  return NextResponse.json({ finalPrice: updated.finalPrice });
}
