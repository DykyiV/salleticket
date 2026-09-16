import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";
import { requestMeta, type TicketHistorySource } from "@/lib/tickets/history";
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
 * PATCH /api/tickets/[id]/passenger
 * Shared passenger-edit endpoint for the account, agent and admin UIs.
 *
 * Permission model:
 *   - the ticket owner may always edit their own passenger data;
 *   - users with the admin-granted `canEditAllTickets` flag may edit any
 *     ticket's passenger data;
 *   - ADMIN / SUPER_ADMIN may edit anything.
 * Everyone else gets 403; unknown tickets get 404.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAuth();
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

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const isAdmin = hasRoleAtLeast(guard.session.role, "ADMIN");
  const isOwner = ticket.userId === guard.session.sub;

  let canEditAll = false;
  if (!isAdmin && !isOwner) {
    const user = await prisma.user.findUnique({
      where: { id: guard.session.sub },
      select: { canEditAllTickets: true },
    });
    canEditAll = user?.canEditAllTickets ?? false;
  }

  if (!isAdmin && !isOwner && !canEditAll) {
    return NextResponse.json(
      { error: "Forbidden: you may only edit your own passengers" },
      { status: 403 }
    );
  }

  const source: TicketHistorySource = isAdmin
    ? "ADMIN_PANEL"
    : isOwner
      ? "ACCOUNT"
      : "AGENT_PANEL";

  try {
    const result = await updatePassengerDetails(id, body, guard.session.sub, {
      source,
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
