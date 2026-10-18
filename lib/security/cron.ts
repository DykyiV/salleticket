import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isProductionRuntime, productionSecretProblem } from "@/lib/security/secrets";

/**
 * Bearer-token check for /api/cron/*. Returns an error response, or null
 * when the caller presented CRON_SECRET. Compared in constant time.
 */
export function checkCronAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret || (isProductionRuntime() && productionSecretProblem("CRON_SECRET", secret))) {
    return NextResponse.json({ error: "CRON_SECRET is not configured on the server" }, { status: 503 });
  }
  const given = req.headers.get("authorization") ?? "";
  // Hash both sides so the comparison is constant-time whatever the lengths.
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(`Bearer ${secret}`).digest();
  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
