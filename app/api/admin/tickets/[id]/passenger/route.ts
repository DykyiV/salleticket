import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
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

/**
 * PATCH /api/admin/tickets/[id]/passenger
 * Body: { firstName?, lastName?, phone?, email? } — only provided fields are
 * updated; an empty email string clears it. Every real change is recorded in
 * the ticket history as PASSENGER_UPDATED with a field-level diff.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;

  let body: PassengerDetailsInput;
  try {
    body = (await req.json()) as PassengerDetailsInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const provided = ["firstName", "lastName", "phone", "email"].filter(
    (k) => body[k as keyof PassengerDetailsInput] !== undefined
  );
  if (provided.length === 0) {
    return NextResponse.json(
      { error: "Provide at least one of: firstName, lastName, phone, email" },
      { status: 400 }
    );
  }

  try {
    const result = await updatePassengerDetails(id, body, guard.session.sub, {
      source: "ADMIN_PANEL",
      request: requestMeta(req),
    });

    return NextResponse.json({
      booking: result.booking,
      changed: result.changed,
      changes: result.changes,
    });
  } catch (err) {
    if (err instanceof TicketNotFoundError || err instanceof BookingNotFoundError) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    if (err instanceof PassengerValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
