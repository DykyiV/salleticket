import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/constants";
import { signSession, verifySession, type SessionPayload } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db";
import type { Role } from "@prisma/client";

/**
 * Server-component / route-handler helper to read the current session.
 * Returns null if the cookie is missing or invalid.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/**
 * Reads the token from a NextRequest (works in middleware + route handlers).
 */
export async function getSessionFromRequest(
  req: NextRequest
): Promise<SessionPayload | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/**
 * Returns the full User from the database based on the current session.
 * Returns null if the session is absent/invalid or the user no longer exists.
 *
 * If the database is unreachable, falls back to the JWT claims so protected
 * pages can still render the user's identity in degraded mode.
 */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
    if (user) return user;
  } catch {
    // Fall through to session-only fallback below.
  }
  return {
    id: session.sub,
    email: session.email,
    role: session.role,
    createdAt: new Date(0),
  };
}

export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function issueSession(user: {
  id: string;
  email: string;
  role: Role;
}): Promise<string> {
  return signSession({ sub: user.id, email: user.email, role: user.role });
}
