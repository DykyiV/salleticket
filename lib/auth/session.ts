import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  APP_SESSION_MAX_AGE_SECONDS,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/constants";
import { sessionTokenFrom } from "@/lib/auth/bearer";
import { signSession, type SessionPayload } from "@/lib/auth/jwt";
import { resolveSession } from "@/lib/auth/resolve";
import { prisma } from "@/lib/db";
import type { Role } from "@prisma/client";

/**
 * Server-component / route-handler helper to read the current session.
 * Returns null if the cookie (site) or bearer token (mobile app) is missing
 * or invalid, the user is gone or the session was revoked. The role comes
 * from the database, not the token.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const [jar, h] = await Promise.all([cookies(), headers()]);
  return resolveSession(sessionTokenFrom(jar.get(SESSION_COOKIE)?.value, h));
}

/**
 * Reads the token from a NextRequest (works in middleware + route handlers).
 */
export async function getSessionFromRequest(
  req: NextRequest
): Promise<SessionPayload | null> {
  return resolveSession(sessionTokenFrom(req.cookies.get(SESSION_COOKIE)?.value, req.headers));
}

/**
 * Returns the full User from the database based on the current session.
 * Returns null if the session is absent/invalid/revoked, the user no longer
 * exists, or the database is unreachable (fail closed).
 */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  try {
    return await prisma.user.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        email: true,
        role: true,
        displayName: true,
        avatarUrl: true,
        canEditDepartures: true,
        canHideStops: true,
        canHideSeats: true,
        notifyChannels: true,
        passwordSet: true,
        createdAt: true,
      },
    });
  } catch {
    return null;
  }
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
  sessionVersion: number;
}): Promise<string> {
  return signSession({ sub: user.id, email: user.email, role: user.role, v: user.sessionVersion });
}

/** A session token for the mobile app: same checks, longer life, no cookie. */
export async function issueAppSession(user: {
  id: string;
  email: string;
  role: Role;
  sessionVersion: number;
}): Promise<{ token: string; expiresAt: string }> {
  const token = await signSession(
    { sub: user.id, email: user.email, role: user.role, v: user.sessionVersion },
    APP_SESSION_MAX_AGE_SECONDS
  );
  return { token, expiresAt: new Date(Date.now() + APP_SESSION_MAX_AGE_SECONDS * 1000).toISOString() };
}

/** The app asks for a token in the body instead of a cookie. */
export function wantsAppToken(body: unknown): boolean {
  return Boolean(body && typeof body === "object" && (body as { client?: unknown }).client === "app");
}
