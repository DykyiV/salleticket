import { NextResponse, type NextRequest } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  issueSession,
  setSessionCookie,
} from "@/lib/auth/session";
import {
  REGISTER_PER_IP,
  blockedFor,
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
  role?: Role;
};

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Некоректний запит" }, { status: 400 });
  }

  const ip = clientIp(req);
  const ipKey = ip ? limitKey("register:ip", ip) : null;
  const wait = ipKey ? await blockedFor(ipKey, REGISTER_PER_IP) : 0;
  if (wait > 0) {
    return NextResponse.json(
      { error: retryMessage(wait, "реєстрацій з вашої мережі") },
      { status: 429, headers: { "Retry-After": String(wait) } }
    );
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Вкажіть коректний e-mail" },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Пароль має містити щонайменше 8 символів" },
      { status: 400 }
    );
  }

  // Self-registration always creates a USER. Elevated roles are assigned
  // separately (e.g. by an ADMIN via /api/admin/users) to prevent privilege
  // escalation by anonymous callers.
  const role: Role = "CUSTOMER";

  // Every attempt counts, so the "already registered" answer below cannot
  // be used to check a long list of e-mails.
  if (ipKey) await recordHit(ipKey, REGISTER_PER_IP);
  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.create({
      data: { email, password: passwordHash, role },
      select: { id: true, email: true, role: true, createdAt: true, sessionVersion: true },
    });

    const token = await issueSession(user);
    const res = NextResponse.json(
      { user: { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt } },
      { status: 201 }
    );
    setSessionCookie(res, token);
    return res;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Не вдалося зареєструватися з цим e-mail. Якщо у вас уже є акаунт — увійдіть." },
        { status: 409 }
      );
    }
    throw err;
  }
}
