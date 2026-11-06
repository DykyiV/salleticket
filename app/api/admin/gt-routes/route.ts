import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { gtListRoutes } from "@/lib/carriers/grandes-tour/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const routes = await gtListRoutes();
  return NextResponse.json({ routes });
}
