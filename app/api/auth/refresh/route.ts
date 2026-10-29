import { NextResponse } from "next/server";
import { issueAppSession } from "@/lib/auth/session";
import { requireAuth } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mobile app: swap a still-valid bearer token for a fresh one (the app calls
 * this on launch, so an active user is never signed out). A revoked or
 * expired token gets 401 like any other request.
 */
export async function POST() {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;
  const user = await prisma.user.findUnique({
    where: { id: guard.session.sub },
    select: { id: true, email: true, role: true, sessionVersion: true, createdAt: true },
  });
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { token, expiresAt } = await issueAppSession(user);
  return NextResponse.json(
    { user: { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt }, token, expiresAt },
    { headers: { "Cache-Control": "no-store" } }
  );
}
