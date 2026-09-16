import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { getTicketPermissions } from "@/lib/tickets/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT = 1000;

async function loadTicketWithPermissions(
  id: string,
  session: Parameters<typeof getTicketPermissions>[0]
) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!ticket) return { ticket: null, perms: null };
  const perms = await getTicketPermissions(session, ticket.userId);
  return { ticket, perms };
}

/**
 * GET /api/tickets/[id]/comments — list comments (view permission required).
 * POST /api/tickets/[id]/comments { text } — add a comment (edit permission:
 * owner, canEditAllTickets, or admin).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const { ticket, perms } = await loadTicketWithPermissions(id, guard.session);
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  if (!perms!.canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const comments = await prisma.ticketComment.findMany({
    where: { ticketId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ comments });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;

  let body: { text?: string };
  try {
    body = (await req.json()) as { text?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (text.length === 0) {
    return NextResponse.json({ error: "`text` must not be empty" }, { status: 400 });
  }
  if (text.length > MAX_TEXT) {
    return NextResponse.json(
      { error: `Comment too long — max ${MAX_TEXT} characters` },
      { status: 400 }
    );
  }

  const { ticket, perms } = await loadTicketWithPermissions(id, guard.session);
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  if (!perms!.canEdit) {
    return NextResponse.json(
      { error: "Forbidden: you may only comment on your own tickets" },
      { status: 403 }
    );
  }

  const comment = await prisma.ticketComment.create({
    data: {
      ticketId: id,
      text,
      authorId: guard.session.sub,
      authorEmail: guard.session.email,
    },
  });
  return NextResponse.json({ comment }, { status: 201 });
}
