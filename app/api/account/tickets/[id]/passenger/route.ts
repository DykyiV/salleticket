import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";
import { requestMeta } from "@/lib/tickets/history";
import {
  BookingNotFoundError,
  PassengerValidationError,
  TicketNotFoundError,
  updatePassengerDetails,
  type PassengerDetailsInput,
} from "@/lib/tickets/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  let body: PassengerDetailsInput;
  try {
    body = (await req.json()) as PassengerDetailsInput;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: params.id },
    select: { userId: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Квиток не знайдено" }, { status: 404 });
  }

  const isOwner = ticket.userId === guard.session.sub;
  const isStaff = hasRoleAtLeast(guard.session.role, "AGENT");
  if (!isOwner && !isStaff) {
    return NextResponse.json(
      { error: "Можна редагувати лише свої квитки" },
      { status: 403 }
    );
  }

  try {
    const result = await updatePassengerDetails(
      params.id,
      body,
      guard.session.sub,
      {
        source: isStaff && !isOwner ? "ADMIN_PANEL" : "ACCOUNT",
        request: requestMeta(req),
      }
    );
    return NextResponse.json({
      booking: result.booking,
      changed: result.changed,
      changes: result.changes,
    });
  } catch (err) {
    if (err instanceof TicketNotFoundError || err instanceof BookingNotFoundError) {
      return NextResponse.json({ error: "Квиток не знайдено" }, { status: 404 });
    }
    if (err instanceof PassengerValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Не вдалося зберегти" },
      { status: 500 }
    );
  }
}
