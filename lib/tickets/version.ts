import { Prisma, type PrismaClient, type Ticket } from "@prisma/client";

/**
 * Thrown when a ticket update loses the optimistic-concurrency race: the
 * row's `version` no longer matches the version the caller read.
 */
export class VersionConflictError extends Error {
  constructor(ticketId: string) {
    super(`Квиток щойно змінено іншим запитом — оновіть і повторіть`);
    this.name = "VersionConflictError";
    this.ticketId = ticketId;
  }
  readonly ticketId: string;
}

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Update a ticket only if its version still equals `expectedVersion`, and
 * bump the version. Mirrors the `version` field pattern from the reference
 * ticketing repo (mongoose-update-if-current), adapted to Prisma.
 */
export async function updateTicketVersioned(
  db: Db,
  ticketId: string,
  expectedVersion: number,
  data: Prisma.TicketUncheckedUpdateInput
): Promise<Ticket> {
  try {
    return await db.ticket.update({
      where: { id: ticketId, version: expectedVersion },
      data: { ...data, version: { increment: 1 } },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      throw new VersionConflictError(ticketId);
    }
    throw err;
  }
}
