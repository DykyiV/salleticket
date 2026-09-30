import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
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
};

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
  if (!email || !password) {
    return NextResponse.json(
      { error: "Вкажіть email і пароль" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const genericError = NextResponse.json(
    { error: "Невірний email або пароль" },
    { status: 401 }
  );

  if (!user?.password) return genericError;

  const ok = await verifyPassword(password, user.password);
  if (!ok) return genericError;

  const claimed = await claimGuestTickets(user.id, readGuestToken(req));
  const token = await issueSession(user);
  const res = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
    claimed,
  });
  setSessionCookie(res, token);
  clearGuestCookie(res);
  return res;
}
