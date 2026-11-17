import { NextResponse } from "next/server";
import { checkHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

/** Is the site alive? Asked by the server's cron every 5 minutes (see lib/health.ts). */
export async function GET() {
  const health = await checkHealth();
  return NextResponse.json(health, { status: health.db ? 200 : 503 });
}
