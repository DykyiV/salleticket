import { randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Anonymous visitor id for seat holds. Issued by the server in an httpOnly
 * cookie, so a script cannot mint a fresh id per request to dodge the
 * per-visitor limit, and nobody can guess another visitor's id to take over
 * their held seats.
 */
export const VISITOR_COOKIE = "asol_visitor";
const VISITOR_RE = /^[a-f0-9]{48}$/;

export function readVisitorId(req: NextRequest): string | null {
  const value = req.cookies.get(VISITOR_COOKIE)?.value;
  return value && VISITOR_RE.test(value) ? value : null;
}

export function visitorId(req: NextRequest): { id: string; isNew: boolean } {
  const existing = readVisitorId(req);
  if (existing) return { id: existing, isNew: false };
  return { id: randomBytes(24).toString("hex"), isNew: true };
}

export function setVisitorCookie(res: NextResponse, id: string): void {
  res.cookies.set(VISITOR_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}
