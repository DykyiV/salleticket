import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { emptySeatLayout } from "@/lib/seats";
import { getTripSeatLayout } from "@/lib/tickets/inventory";
import { FULL_ROUTE, type Segment } from "@/lib/trips/segments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

function parseSegment(req: NextRequest): Segment {
  const from = Number(req.nextUrl.searchParams.get("fromIndex"));
  const to = Number(req.nextUrl.searchParams.get("toIndex"));
  if (Number.isInteger(from) && Number.isInteger(to) && from >= 0 && to > from) {
    return { fromIndex: from, toIndex: to };
  }
  return FULL_ROUTE;
}

export async function GET(req: NextRequest, { params }: Params) {
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
  const sessionId = req.nextUrl.searchParams.get("sessionId") ?? undefined;
  const segment = parseSegment(req);
  const layout = await getTripSeatLayout(prisma, params.id, except, sessionId, segment);
  return NextResponse.json({ layout });
}
