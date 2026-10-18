import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

type Db = PrismaClient | Prisma.TransactionClient;

/** Append a security audit entry (role changes, permission edits, …). */
export async function recordAudit(
  entry: {
    actorId?: string | null;
    actorEmail?: string | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    changes?: Record<string, unknown> | null;
    ipAddress?: string | null;
  },
  db: Db = prisma
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      actorEmail: entry.actorEmail ?? null,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      changes: entry.changes ? JSON.stringify(entry.changes) : null,
      ipAddress: entry.ipAddress ?? null,
    },
  });
}

export async function listAudit(limit = 50) {
  return prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}
