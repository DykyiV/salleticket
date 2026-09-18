import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";
import { requestMeta, recordTicketHistory } from "@/lib/tickets/history";
import {
  SeatRequiredError,
  SeatTakenError,
  assertSeatAvailable,
} from "@/lib/tickets/inventory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

async function canMutate(ticketUserId: string, sessionSub: string, role: string) {
  return ticketUserId === sessionSub || hasRoleAtLeast(role as never, "AGENT");
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  let body: { seatNumber?: number; leg?: "outbound" | "return" };
  try {
    body = (await req.json()) as { seatNumber?: number; leg?: "outbound" | "return" };
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, tripId: true, returnTripId: true, seatNumber: true, returnSeatNumber: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Квиток не знайдено" }, { status: 404 });
  }
  if (!(await canMutate(ticket.userId, guard.session.sub, guard.session.role))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const leg = body.leg === "return" ? "return" : "outbound";
  const tripId = leg === "return" ? ticket.returnTripId : ticket.tripId;
  if (!tripId) {
    return NextResponse.json({ error: "Немає рейсу для цієї ділянки" }, { status: 400 });
  }

  try {
    const seat = await assertSeatAvailable(
      prisma,
      tripId,
      body.seatNumber,
      ticket.id
    );
    const data =
      leg === "return"
        ? { returnSeatNumber: seat }
        : { seatNumber: seat };
    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data,
    });
    await recordTicketHistory(prisma, {
      ticketId: ticket.id,
      action: "SEAT_CHANGED",
      source: hasRoleAtLeast(guard.session.role, "AGENT") ? "ADMIN_PANEL" : "ACCOUNT",
      changedBy: guard.session.sub,
      request: requestMeta(req),
      changes: {
        [leg === "return" ? "returnSeatNumber" : "seatNumber"]: {
          from: leg === "return" ? ticket.returnSeatNumber : ticket.seatNumber,
          to: seat,
        },
      },
    });
    return NextResponse.json({ ticket: updated });
  } catch (err) {
    if (err instanceof SeatTakenError || err instanceof SeatRequiredError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Не вдалося змінити місце" },
      { status: 500 }
    );
  }
}
