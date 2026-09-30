import { NextResponse, type NextRequest } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  issueSession,
  setSessionCookie,
} from "@/lib/auth/session";
import { claimGuestTickets, clearGuestCookie, readGuestToken } from "@/lib/auth/guest";

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
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Вкажіть коректний email" },
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

  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.create({
      data: { email, password: passwordHash, role },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    const claimed = await claimGuestTickets(user.id, readGuestToken(req));
    const token = await issueSession(user);
    const res = NextResponse.json({ user, claimed }, { status: 201 });
    setSessionCookie(res, token);
    clearGuestCookie(res);
    return res;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Акаунт з таким email уже існує" },
        { status: 409 }
      );
    }
    throw err;
  }
}
