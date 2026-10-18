import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { resolveSession, revokeSessions } from "@/lib/auth/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Log out: clears the cookie and revokes the user's sessions server-side,
 * so a copied token stops working too (on every device).
 */
export async function POST(req: NextRequest) {
  const session = await resolveSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) await revokeSessions(session.sub);
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
