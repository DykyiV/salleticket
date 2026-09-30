import { randomBytes } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

export const GUEST_COOKIE = "asol_guest";
export const GUEST_EMAIL = "guest-hold@asolbus.local";
const GUEST_MAX_AGE = 60 * 60 * 24 * 14;

/** Shared holder for bookings made before sign-in. Tickets move off it on claim. */
export async function ensureGuestHolder() {
  const existing = await prisma.user.findUnique({ where: { email: GUEST_EMAIL } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      email: GUEST_EMAIL,
      password: await hashPassword(randomBytes(24).toString("hex")),
      role: "CUSTOMER",
      displayName: "Гість",
      authProvider: "password",
    },
  });
}

export function readGuestToken(req: NextRequest): string | null {
  const value = req.cookies.get(GUEST_COOKIE)?.value?.trim();
  return value || null;
}

/** Returns the browser claim token, creating one when the cookie is missing. */
export function guestTokenForRequest(req: NextRequest): { token: string; isNew: boolean } {
  const existing = readGuestToken(req);
  if (existing) return { token: existing, isNew: false };
  return { token: randomBytes(24).toString("hex"), isNew: true };
}

export function setGuestCookie(res: NextResponse, token: string): void {
  res.cookies.set({
    name: GUEST_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GUEST_MAX_AGE,
  });
}

export function clearGuestCookie(res: NextResponse): void {
  res.cookies.set({
    name: GUEST_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

/** Moves this browser's guest bookings onto the account that just signed in. */
export async function claimGuestTickets(userId: string, token: string | null | undefined): Promise<number> {
  if (!token) return 0;
  const guest = await prisma.user.findUnique({ where: { email: GUEST_EMAIL } });
  if (!guest || guest.id === userId) return 0;
  const moved = await prisma.ticket.updateMany({
    where: { guestClaim: token, userId: guest.id },
    data: { userId, guestClaim: null },
  });
  return moved.count;
}
