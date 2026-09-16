import type {
  Booking,
  Prisma,
  PrismaClient,
  Ticket,
  TicketStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  diffChanges,
  recordTicketHistory,
  type RequestMeta,
  type TicketHistorySource,
} from "@/lib/tickets/history";

export type UpdateTicketStatusOptions = {
  /** Audit trail origin. Defaults to "API". */
  source?: TicketHistorySource;
  /**
   * Custom label for the history action column. Defaults to "STATUS_CHANGE"
   * for real transitions and "STATUS_CONFIRMED" when newStatus matches the
   * current one (so the audit still captures who confirmed it).
   */
  action?: string;
  /** IP + User-Agent from the originating request. */
  request?: RequestMeta;
};

export type UpdateTicketStatusResult = {
  ticket: Ticket;
  oldStatus: TicketStatus;
  newStatus: TicketStatus;
  changed: boolean;
};

export class TicketNotFoundError extends Error {
  constructor(id: string) {
    super(`Ticket not found: ${id}`);
    this.name = "TicketNotFoundError";
  }
}

type DbLike = PrismaClient | Prisma.TransactionClient;

/**
 * Transition a ticket to a new status and append an audit row.
 *
 * Steps (always executed inside a single transaction):
 *   1. Read the current ticket (throws TicketNotFoundError if missing).
 *   2. Save the old status.
 *   3. Update ticket.status to the new value (no-op if it already matches).
 *   4. Append a TicketHistory row with { oldStatus, newStatus, changedBy,
 *      source, ipAddress, userAgent, changes: { status: { from, to } } }.
 *
 * Can be called with the top-level `prisma` client (opens its own
 * transaction) or re-used from an existing $transaction by passing `tx`.
 */
export async function updateTicketStatus(
  ticketId: string,
  newStatus: TicketStatus,
  userId: string | null,
  options: UpdateTicketStatusOptions = {},
  tx?: Prisma.TransactionClient
): Promise<UpdateTicketStatusResult> {
  const run = async (db: DbLike): Promise<UpdateTicketStatusResult> => {
    const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new TicketNotFoundError(ticketId);

    const oldStatus = ticket.status;
    const changed = oldStatus !== newStatus;

    const updated = changed
      ? await db.ticket.update({
          where: { id: ticketId },
          data: { status: newStatus },
        })
      : ticket;

    await recordTicketHistory(db, {
      ticketId,
      action:
        options.action ?? (changed ? "STATUS_CHANGE" : "STATUS_CONFIRMED"),
      oldStatus,
      newStatus,
      changes: changed
        ? { status: { from: oldStatus, to: newStatus } }
        : null,
      source: options.source ?? "API",
      changedBy: userId,
      request: options.request,
    });

    return { ticket: updated, oldStatus, newStatus, changed };
  };

  if (tx) return run(tx);
  return prisma.$transaction((t) => run(t));
}

// ---------------------------------------------------------------------------
// Passenger details editing
// ---------------------------------------------------------------------------

export class BookingNotFoundError extends Error {
  constructor(ticketId: string) {
    super(`Ticket has no booking: ${ticketId}`);
    this.name = "BookingNotFoundError";
  }
}

export class PassengerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PassengerValidationError";
  }
}

export type PassengerDetailsInput = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  /** Empty string clears the email (column is nullable). */
  email?: string | null;
};

export type UpdatePassengerDetailsOptions = {
  source?: TicketHistorySource;
  request?: RequestMeta;
};

export type UpdatePassengerDetailsResult = {
  booking: Booking;
  changed: boolean;
  changes: Record<string, { from: unknown; to: unknown }>;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanName(value: string | undefined, field: string): string | undefined {
  if (value === undefined) return undefined;
  const v = value.trim();
  if (v.length === 0) throw new PassengerValidationError(`${field} must not be empty`);
  if (v.length > 100) throw new PassengerValidationError(`${field} is too long (max 100)`);
  return v;
}

function cleanPhone(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const v = value.trim();
  if (v.length === 0) throw new PassengerValidationError("phone must not be empty");
  if (!/^[+0-9()\-\s]{5,20}$/.test(v)) {
    throw new PassengerValidationError("phone has an invalid format");
  }
  return v;
}

function cleanEmail(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const v = (value ?? "").trim();
  if (v === "") return null;
  if (!EMAIL_RE.test(v)) throw new PassengerValidationError("email has an invalid format");
  return v;
}

/**
 * Edit passenger details stored on the ticket's Booking (firstName, lastName,
 * phone, email) and append an audit row with the full field diff.
 *
 * Only the provided fields are touched. If nothing actually changed, no
 * history row is written and `changed` is false. Runs in a single
 * transaction; can be re-used inside an existing $transaction via `tx`.
 */
export async function updatePassengerDetails(
  ticketId: string,
  input: PassengerDetailsInput,
  userId: string | null,
  options: UpdatePassengerDetailsOptions = {},
  tx?: Prisma.TransactionClient
): Promise<UpdatePassengerDetailsResult> {
  const run = async (db: DbLike): Promise<UpdatePassengerDetailsResult> => {
    const ticket = await db.ticket.findUnique({
      where: { id: ticketId },
      include: { booking: true },
    });
    if (!ticket) throw new TicketNotFoundError(ticketId);
    if (!ticket.booking) throw new BookingNotFoundError(ticketId);

    const next: Prisma.BookingUpdateInput = {};
    const firstName = cleanName(input.firstName, "firstName");
    const lastName = cleanName(input.lastName, "lastName");
    const phone = cleanPhone(input.phone);
    const email = cleanEmail(input.email);
    if (firstName !== undefined) next.firstName = firstName;
    if (lastName !== undefined) next.lastName = lastName;
    if (phone !== undefined) next.phone = phone;
    if (email !== undefined) next.email = email;

    const before = {
      firstName: ticket.booking.firstName,
      lastName: ticket.booking.lastName,
      phone: ticket.booking.phone,
      email: ticket.booking.email,
    };
    const after = {
      firstName: (next.firstName as string | undefined) ?? before.firstName,
      lastName: (next.lastName as string | undefined) ?? before.lastName,
      phone: (next.phone as string | undefined) ?? before.phone,
      email: next.email !== undefined ? (next.email as string | null) : before.email,
    };
    const changes = diffChanges(before, after);

    if (Object.keys(changes).length === 0) {
      return { booking: ticket.booking, changed: false, changes: {} };
    }

    const booking = await db.booking.update({
      where: { id: ticket.booking.id },
      data: next,
    });

    await recordTicketHistory(db, {
      ticketId,
      action: "PASSENGER_UPDATED",
      changes,
      source: options.source ?? "ADMIN_PANEL",
      changedBy: userId,
      request: options.request,
    });

    return { booking, changed: true, changes };
  };

  if (tx) return run(tx);
  return prisma.$transaction((t) => run(t));
}
