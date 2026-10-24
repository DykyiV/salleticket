import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getSession, issueSession, setSessionCookie } from "@/lib/auth/session";
import {
  GUEST_PER_IP,
  LOGIN_PER_ACCOUNT,
  LOGIN_PER_IP,
  blockedFor,
  clearHits,
  clientIp,
  limitKey,
  recordHit,
  retryMessage,
} from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/**
 * Checkout without registration.
 *
 *  - New e-mail → a passenger account is created and this browser is
 *    signed in to it (the ticket lands in «Мої квитки»; a password can be
 *    set later in the cabinet).
 *  - E-mail that already has an account → the password is required, so
 *    nobody can put bookings into someone else's cabinet.
 *
 * Responses: 200 {status:"created"|"signed_in"}, 409 {status:"password_required"},
 * 401 wrong password, 429 too many attempts.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session) return NextResponse.json({ status: "signed_in" });

  let body: { email?: string; password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний запит" }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase() ?? "";
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return NextResponse.json({ error: "Вкажіть коректний e-mail" }, { status: 400 });
  }

  const ip = clientIp(req);
  const ipKey = ip ? limitKey("guest:ip", ip) : null;
  const ipWait = ipKey ? await blockedFor(ipKey, GUEST_PER_IP) : 0;
  if (ipWait > 0) {
    return NextResponse.json(
      { error: retryMessage(ipWait) },
      { status: 429, headers: { "Retry-After": String(ipWait) } }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (!body.password) {
      if (ipKey) await recordHit(ipKey, GUEST_PER_IP);
      return NextResponse.json({ status: "password_required" }, { status: 409 });
    }
    const accountKey = limitKey("login:acct", email);
    const loginIpKey = ip ? limitKey("login:ip", ip) : null;
    const wait = Math.max(
      await blockedFor(accountKey, LOGIN_PER_ACCOUNT),
      loginIpKey ? await blockedFor(loginIpKey, LOGIN_PER_IP) : 0
    );
    if (wait > 0) {
      return NextResponse.json(
        { error: retryMessage(wait, "спроб входу") },
        { status: 429, headers: { "Retry-After": String(wait) } }
      );
    }
    if (!(await verifyPassword(body.password, existing.password))) {
      await recordHit(accountKey, LOGIN_PER_ACCOUNT);
      if (loginIpKey) await recordHit(loginIpKey, LOGIN_PER_IP);
      return NextResponse.json({ error: "Невірний пароль" }, { status: 401 });
    }
    await clearHits(accountKey);
    const res = NextResponse.json({ status: "signed_in" });
    setSessionCookie(res, await issueSession(existing));
    return res;
  }

  if (ipKey) await recordHit(ipKey, GUEST_PER_IP);
  try {
    const user = await prisma.user.create({
      data: {
        email,
        // Unknown random password until the passenger sets one in the cabinet.
        password: await hashPassword(randomBytes(24).toString("hex")),
        passwordSet: false,
        role: "CUSTOMER",
      },
    });
    const res = NextResponse.json({ status: "created" });
    setSessionCookie(res, await issueSession(user));
    return res;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ status: "password_required" }, { status: 409 });
    }
    throw err;
  }
}
