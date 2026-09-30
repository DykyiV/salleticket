import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { requestMeta, recordTicketHistory } from "@/lib/tickets/history";
import { updateTicketVersioned, VersionConflictError } from "@/lib/tickets/version";
import {
  SeatRequiredError,
  SeatTakenError,
  assertSeatAvailable,
} from "@/lib/tickets/inventory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function canMutate(role: string, isOwner: boolean) {
  if (isOwner) return true;
  return hasRoleAtLeast(role as never, "AGENT") && (await can({ role: role as never }, "booking.edit"));
}

export async function PATCH(req: NextRequest, props: Params) {
  const params = await props.params;
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
    select: { id: true, userId: true, tripId: true, returnTripId: true, seatNumber: true, returnSeatNumber: true, version: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Квиток не знайдено" }, { status: 404 });
  }
  const isOwner = ticket.userId === guard.session.sub;
  if (!(await canMutate(guard.session.role, isOwner))) {
    return NextResponse.json({ error: "Немає доступу змінювати місце" }, { status: 403 });
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
    const updated = await updateTicketVersioned(prisma, ticket.id, ticket.version, data);
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
    if (err instanceof VersionConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof SeatTakenError || err instanceof SeatRequiredError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Не вдалося змінити місце" },
      { status: 500 }
    );
  }
}
