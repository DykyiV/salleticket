import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { utcDateOnly } from "@/lib/routes/dates";
import { generateDepartures } from "@/lib/routes/generate";
import { RouteValidationError } from "@/lib/routes/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const from = utcDateOnly(String(body.from ?? ""));
    const to = utcDateOnly(String(body.to ?? ""));
    if (to.getTime() < from.getTime()) {
      throw new RouteValidationError("Дата «до» не може бути раніше за «від»");
    }
    const result = await generateDepartures({
      templateId: params.id,
      from,
      to,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generate failed";
    const status = err instanceof RouteValidationError ? 400 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
