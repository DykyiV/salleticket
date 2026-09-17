import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { listDepartures } from "@/lib/routes/listDepartures";
import { departureCapabilities } from "@/lib/routes/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireRole("AGENT");
  if (!guard.ok) return guard.response;

  const user = await prisma.user.findUnique({
    where: { id: guard.session.sub },
    select: {
      role: true,
      canEditDepartures: true,
      canHideStops: true,
      canHideSeats: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  try {
    const result = await listDepartures({
      from: params.get("from"),
      to: params.get("to"),
      templateId: params.get("templateId"),
      page: params.get("page"),
      pageSize: params.get("pageSize"),
    });
    return NextResponse.json({
      ...result,
      capabilities: departureCapabilities(user),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid date" },
      { status: 400 }
    );
  }
}
