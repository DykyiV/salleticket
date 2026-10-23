import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { updateTicketStatus } from "@/lib/tickets/service";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Limits for "pay on the bus" bookings made by passengers themselves, so
 * nobody can reserve a whole coach for free and not show up. Agents, the
 * cash desk and office staff are not limited.
 */
export const CASH_SEATS_PER_TRIP = 4;
export const CASH_ACTIVE_BOOKINGS = 3;
/** Unpaid reservations are closed as no-show this long after arrival. */
export const NO_SHOW_AFTER_ARRIVAL_HOURS = 12;

export class CashLimitError extends Error {}

/** Last 9 digits — the same number written as +380…, 380…, 0… matches. */
export function phoneKey(phone: string): string {
  return phone.replace(/\D/g, "").slice(-9);
}

/**
 * Throws CashLimitError when a new cash booking of `seats` seats on
 * `tripId` would exceed the limits for this account or phone number.
 */
export async function assertCashBookingAllowed(
  input: { userId: string; phone: string; tripId: string | null; seats: number },
  db: Db = prisma
): Promise<void> {
  const key = phoneKey(input.phone);
  const active = await db.booking.findMany({
    where: {
      ticket: { status: "RESERVED", trip: { departureTime: { gt: new Date() } } },
    },
    select: {
      reference: true,
      groupRef: true,
      phone: true,
      ticket: { select: { userId: true, tripId: true } },
    },
  });
  const mine = active.filter(
    (b) => b.ticket.userId === input.userId || (key.length >= 7 && phoneKey(b.phone) === key)
  );

  {
    const onTrip = input.tripId
      ? mine.filter((b) => b.ticket.tripId === input.tripId).length
      : 0;
    if (onTrip + input.seats > CASH_SEATS_PER_TRIP) {
      throw new CashLimitError(
        `З оплатою в автобусі можна забронювати не більше ${CASH_SEATS_PER_TRIP} місць на рейс` +
          (onTrip ? ` (у вас уже ${onTrip}).` : ".") +
          " Для групи — зверніться в касу або до агента."
      );
    }
  }

  const groups = new Set(mine.map((b) => b.groupRef ?? b.reference));
  if (groups.size >= CASH_ACTIVE_BOOKINGS) {
    throw new CashLimitError(
      `У вас уже ${groups.size} неоплачені бронювання з оплатою в автобусі. ` +
        "Оплатіть або скасуйте одне з них, щоб забронювати ще."
    );
  }
}

/**
 * Unpaid "pay on the bus" reservations whose trip arrived long ago: the
 * passenger never paid — close them as no-show so they stop counting.
 */
export async function closeNoShowReservations(db: Db = prisma): Promise<number> {
  const cutoff = new Date(Date.now() - NO_SHOW_AFTER_ARRIVAL_HOURS * 3_600_000);
  const stale = await db.ticket.findMany({
    where: { status: "RESERVED", trip: { arrivalTime: { lt: cutoff } } },
    select: { id: true },
    take: 200,
  });
  for (const t of stale) {
    await updateTicketStatus(t.id, "CANCELLED", null, { source: "SYSTEM", action: "NO_SHOW" });
  }
  return stale.length;
}
