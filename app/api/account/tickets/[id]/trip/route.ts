import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";
import { recordTicketHistory, requestMeta } from "@/lib/tickets/history";
import { updateTicketVersioned, VersionConflictError } from "@/lib/tickets/version";
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
    return NextResponse.json({ error: "Вкажіть рейс" }, { status: 400 });
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

  const nextTrip = await prisma.trip.findUnique({
    where: { id: body.tripId },
  });
  if (!nextTrip) {
    return NextResponse.json({ error: "Рейс не знайдено" }, { status: 404 });
  }
  if (
    ticket.trip &&
    (nextTrip.fromCity !== ticket.trip.fromCity ||
      nextTrip.toCity !== ticket.trip.toCity)
  ) {
    return NextResponse.json(
      { error: "Новий рейс має бути в тому ж напрямку" },
      { status: 400 }
    );
  }

  try {
    const seat = await assertSeatAvailable(
      prisma,
      nextTrip.id,
      body.seatNumber,
      ticket.id
    );
    const updated = await updateTicketVersioned(prisma, ticket.id, ticket.version, {
      tripId: nextTrip.id,
      seatNumber: seat,
    });
    await recordTicketHistory(prisma, {
      ticketId: ticket.id,
      action: "TRIP_CHANGED",
      source: staff ? "ADMIN_PANEL" : "ACCOUNT",
      changedBy: guard.session.sub,
      request: requestMeta(req),
      changes: {
        tripId: { from: ticket.tripId, to: nextTrip.id },
        seatNumber: { from: ticket.seatNumber, to: seat },
      },
    });
    return NextResponse.json({ ticket: updated });
  } catch (err) {
    if (err instanceof VersionConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof SeatTakenError || err instanceof SeatRequiredError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Не вдалося змінити рейс" },
      { status: 500 }
    );
  }
}
