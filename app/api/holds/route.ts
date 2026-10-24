import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readVisitorId } from "@/lib/security/visitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** This visitor's seat holds (checkout countdown). */
export async function GET(req: NextRequest) {
  const visitor = readVisitorId(req);
  if (!visitor) return NextResponse.json({ holds: [] });
  const holds = await prisma.seatHold.findMany({
    where: { sessionId: visitor, expiresAt: { gt: new Date() } },
    select: { tripId: true, seatNumber: true, fromStopIndex: true, toStopIndex: true, expiresAt: true },
    orderBy: { expiresAt: "asc" },
  });
  return NextResponse.json({ holds });
}
