import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { issueSession, setSessionCookie } from "@/lib/auth/session";
import {
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

type Body = {
  email?: string;
  password?: string;
};

/** Compared when the e-mail is unknown, so both cases take the same time. */
const DUMMY_HASH = "$2b$10$xY6Qoxrvjz3eSbGeMl9t4uBW6BGz9ZUqEa/HPbsW.bDhb2YzVYqAO";

const INVALID = "Невірний e-mail або пароль";

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Некоректний запит" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ error: "Вкажіть e-mail і пароль" }, { status: 400 });
  }

  const accountKey = limitKey("login:acct", email);
  const ip = clientIp(req);
  const ipKey = ip ? limitKey("login:ip", ip) : null;
  const wait = Math.max(
    await blockedFor(accountKey, LOGIN_PER_ACCOUNT),
    ipKey ? await blockedFor(ipKey, LOGIN_PER_IP) : 0
  );
  if (wait > 0) {
    return NextResponse.json(
      { error: retryMessage(wait, "спроб входу") },
      { status: 429, headers: { "Retry-After": String(wait) } }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await verifyPassword(password, user?.password ?? DUMMY_HASH);
  if (!user || !ok) {
    await recordHit(accountKey, LOGIN_PER_ACCOUNT);
    if (ipKey) await recordHit(ipKey, LOGIN_PER_IP);
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }

  await clearHits(accountKey);
  const token = await issueSession(user);
  const res = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
  });
  setSessionCookie(res, token);
  return res;
}
