import { NextResponse, type NextRequest } from "next/server";
import { ResetTokenError, resetPasswordWithToken } from "@/lib/auth/passwordReset";
import { issueSession, setSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { token, password } — sets the new password from the «Забули пароль?»
 * link and signs the user in. 400 for an invalid or expired link.
 */
export async function POST(req: NextRequest) {
  let body: { token?: string; password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний запит" }, { status: 400 });
  }
  const password = body.password ?? "";
  if (password.length < 8) {
    return NextResponse.json({ error: "password_too_short" }, { status: 400 });
  }
  try {
    const user = await resetPasswordWithToken(body.token ?? "", password);
    const res = NextResponse.json({ user: { role: user.role } });
    setSessionCookie(res, await issueSession(user));
    return res;
  } catch (err) {
    if (err instanceof ResetTokenError) return NextResponse.json({ error: "invalid_link" }, { status: 400 });
    throw err;
  }
}
