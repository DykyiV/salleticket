import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { listDepartures } from "@/lib/routes/listDepartures";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const params = req.nextUrl.searchParams;
  try {
    const result = await listDepartures({
      from: params.get("from"),
      to: params.get("to"),
      templateId: params.get("templateId"),
      countryId: params.get("countryId"),
      page: params.get("page"),
      pageSize: params.get("pageSize"),
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid date" },
      { status: 400 }
    );
  }
}
