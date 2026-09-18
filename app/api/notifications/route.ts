import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";
import { sweepUnpaidTickets } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAFF_ROLES = ["MANAGER", "ADMIN", "SUPER_ADMIN"] as const;

export async function GET() {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;
  const role = guard.session.role;

  if (hasRoleAtLeast(role, "AGENT")) {
    await sweepUnpaidTickets();
  }

  const staff = hasRoleAtLeast(role, "MANAGER");
  const notifications = await prisma.notification.findMany({
    where: {
      OR: [
        { userId: guard.session.sub },
        { role },
        ...(staff ? STAFF_ROLES.filter((r) => r !== role).map((r) => ({ role: r as never })) : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      link: n.link,
      read: n.readAt != null,
      createdAt: n.createdAt,
    })),
    unread: notifications.filter((n) => !n.readAt).length,
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  let body: { ids?: string[] };
  try {
    body = (await req.json()) as { ids?: string[] };
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  const ids = body.ids ?? [];
  if (!ids.length) return NextResponse.json({ ok: true });

  await prisma.notification.updateMany({
    where: { id: { in: ids }, readAt: null },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
