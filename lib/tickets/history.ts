import type { NextRequest } from "next/server";
import type {
  Prisma,
  PrismaClient,
  TicketStatus,
  TicketHistory,
} from "@prisma/client";

/**
 * Known origins of a ticket mutation. We keep this as a string column in the
 * DB so new sources can be added without a migration; the app uses this
 * union for type-safety only.
 */
export type TicketHistorySource =
  | "BOOKING_FORM"   // end-user creating a booking
  | "ADMIN_PANEL"    // /admin/** admin action
  | "ACCOUNT"        // user cancelling their own ticket etc.
  | "API"            // external API integration / carrier callback
  | "SYSTEM";        // scheduled jobs, internal system changes

export type FieldChange = { from: unknown; to: unknown };
export type ChangeSet = Record<string, FieldChange>;

export type RequestMeta = {
  ipAddress: string | null;
  userAgent: string | null;
};

/**
 * Pull best-effort IP and User-Agent from the incoming request. Relies on
 * the usual forwarding headers first, then falls back to x-real-ip.
 */
export function requestMeta(req: NextRequest): RequestMeta {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for");
  const ip = fwd
    ? fwd.split(",")[0]?.trim() ?? null
    : h.get("x-real-ip") ?? null;
  const ua = h.get("user-agent") ?? null;
  return { ipAddress: ip, userAgent: ua };
}

/**
 * Produce a shallow diff between `before` and `after`. Keys present only in
 * `after` are treated as additions ({ from: null, to: newValue }); keys only
 * in `before` as deletions ({ from: oldValue, to: null }). Equal values are
 * skipped.
 */
export function diffChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): ChangeSet {
  const out: ChangeSet = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    const a = before[k];
    const b = after[k];
    if (valueEquals(a, b)) continue;
    out[k] = { from: a ?? null, to: b ?? null };
  }
  return out;
}

function valueEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) < 1e-9;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

type DbLike = Pick<PrismaClient, "ticketHistory"> | Prisma.TransactionClient;

type RecordArgs = {
  ticketId: string;
  action: string;
  source: TicketHistorySource;
  changedBy?: string | null;
  oldStatus?: TicketStatus | null;
  newStatus?: TicketStatus | null;
  /** Shallow diff of changed fields. */
  changes?: ChangeSet | null;
  /** Request metadata (ip + ua). */
  request?: RequestMeta;
  timestamp?: Date;
};

/**
 * Append a TicketHistory row. Works both with the top-level `prisma` client
 * and with a `$transaction` client, so callers can persist it atomically
 * with the mutation itself.
 */
export async function recordTicketHistory(
  db: DbLike,
  args: RecordArgs
): Promise<TicketHistory> {
  const serializedChanges =
    args.changes && Object.keys(args.changes).length > 0
      ? JSON.stringify(args.changes)
      : null;

  return db.ticketHistory.create({
    data: {
      ticketId: args.ticketId,
      action: args.action,
      oldStatus: args.oldStatus ?? null,
      newStatus: args.newStatus ?? null,
      changes: serializedChanges,
      source: args.source,
      changedBy: args.changedBy ?? null,
      ipAddress: args.request?.ipAddress ?? null,
      userAgent: args.request?.userAgent ?? null,
      timestamp: args.timestamp ?? new Date(),
    },
  });
}
