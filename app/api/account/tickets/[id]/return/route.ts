import { NextResponse, type NextRequest } from "next/server";
import { TripKind } from "@prisma/client";
import { requireAuth } from "@/lib/auth/guard";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";
import { recordTicketHistory, requestMeta } from "@/lib/tickets/history";
import {
  SeatRequiredError,
  SeatTakenError,
  assertSeatAvailable,
} from "@/lib/tickets/inventory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  let body: { tripId?: string; seatNumber?: number | null };
  try {
    body = (await req.json()) as { tripId?: string; seatNumber?: number | null };
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  if (!body.tripId) {
    return NextResponse.json({ error: "Вкажіть рейс повернення" }, { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: params.id },
    include: { trip: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Квиток не знайдено" }, { status: 404 });
  }
  const staff = hasRoleAtLeast(guard.session.role, "AGENT");
  if (ticket.userId !== guard.session.sub && !staff) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }
  if (ticket.tripKind === TripKind.ONE_WAY) {
    return NextResponse.json(
      { error: "Це квиток в одну сторону" },
      { status: 400 }
    );
  }

  const returnTrip = await prisma.trip.findUnique({
    where: { id: body.tripId },
  });
  if (!returnTrip) {
    return NextResponse.json({ error: "Рейс не знайдено" }, { status: 404 });
  }
  if (
    ticket.trip &&
    (returnTrip.fromCity !== ticket.trip.toCity ||
      returnTrip.toCity !== ticket.trip.fromCity)
  ) {
    return NextResponse.json(
      { error: "Повернення має бути в зворотному напрямку" },
      { status: 400 }
    );
  }

  try {
    const seat = await assertSeatAvailable(
      prisma,
      returnTrip.id,
      body.seatNumber,
      ticket.id
    );
    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        returnTripId: returnTrip.id,
        returnSeatNumber: seat,
        tripKind: TripKind.ROUND_TRIP,
      },
    });
    await recordTicketHistory(prisma, {
      ticketId: ticket.id,
      action: "RETURN_ASSIGNED",
      source: staff ? "ADMIN_PANEL" : "ACCOUNT",
      changedBy: guard.session.sub,
      request: requestMeta(req),
      changes: {
        returnTripId: { from: ticket.returnTripId, to: returnTrip.id },
        returnSeatNumber: { from: ticket.returnSeatNumber, to: seat },
      },
    });
    return NextResponse.json({ ticket: updated });
  } catch (err) {
    if (err instanceof SeatTakenError || err instanceof SeatRequiredError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Не вдалося призначити повернення" },
      { status: 500 }
    );
  }
}
