import { NextResponse, type NextRequest } from "next/server";
import { setVisitorCookie, visitorId } from "@/lib/security/visitor";
import { prisma } from "@/lib/db";
import { emptySeatLayout } from "@/lib/seats";
import { gtSeatLayout } from "@/lib/carriers/grandes-tour";
import { grandesTourEnabled } from "@/lib/carriers/grandes-tour/client";
import { getDict } from "@/lib/i18n/server";
import { getTripSeatLayout } from "@/lib/tickets/inventory";
import { FULL_ROUTE, type Segment } from "@/lib/trips/segments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function parseSegment(req: NextRequest): Segment {
  const from = Number(req.nextUrl.searchParams.get("fromIndex"));
  const to = Number(req.nextUrl.searchParams.get("toIndex"));
  if (Number.isInteger(from) && Number.isInteger(to) && from >= 0 && to > from) {
    return { fromIndex: from, toIndex: to };
  }
  return FULL_ROUTE;
}

export async function GET(req: NextRequest, props: Params) {
  const params = await props.params;
  // Grandes Tour: live seat map from their system (no holds on our side).
  if (params.id.startsWith("gt-")) {
    if (!grandesTourEnabled()) return NextResponse.json({ layout: emptySeatLayout(), virtual: true });
    const { t } = await getDict();
    const layout = await gtSeatLayout(params.id, [t.seat.deckLower, t.seat.deckUpper]).catch(() => null);
    return layout && layout.seatCount
      ? NextResponse.json({ layout, external: true })
      : NextResponse.json({ layout: emptySeatLayout(), virtual: true });
  }
  const trip = await prisma.trip.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!trip) {
    return NextResponse.json({
      layout: emptySeatLayout(),
      virtual: true,
    });
  }

  const except = req.nextUrl.searchParams.get("exceptTicketId") ?? undefined;
  // Own holds show as free — the visitor is identified by the cookie only.
  // The cookie is issued here, before the first seat is picked, so parallel
  // holds (outbound + return) land on the same visitor.
  const visitor = visitorId(req);
  const sessionId = visitor.isNew ? undefined : visitor.id;
  const assignmentId = req.nextUrl.searchParams.get("assignmentId") ?? undefined;
  const segment = parseSegment(req);
  const layout = await getTripSeatLayout(
    prisma,
    params.id,
    except,
    sessionId,
    segment,
    assignmentId
  );
  const res = NextResponse.json({ layout });
  if (visitor.isNew) setVisitorCookie(res, visitor.id);
  return res;
}
