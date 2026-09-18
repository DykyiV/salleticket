import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { emptySeatLayout } from "@/lib/seats";
import { getTripSeatLayout } from "@/lib/tickets/inventory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

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
  const layout = await getTripSeatLayout(prisma, params.id, except);
  return NextResponse.json({ layout });
}
