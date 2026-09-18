import type { Prisma, PrismaClient, Role } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Notification Center. Role-targeted rows are read by everyone with that
 * role (or higher staff); user-targeted rows are personal.
 */
export type NotifyInput = {
  kind: string;
  title: string;
  body?: string;
  link?: string;
};

type Db = PrismaClient | Prisma.TransactionClient;

export async function notifyRoles(
  roles: Role[],
  input: NotifyInput,
  db: Db = prisma
): Promise<void> {
  for (const role of roles) {
    await db.notification.create({
      data: { role, kind: input.kind, title: input.title, body: input.body, link: input.link },
    });
  }
}

export async function notifyUser(
  userId: string,
  input: NotifyInput,
  db: Db = prisma
): Promise<void> {
  await db.notification.create({
    data: { userId, kind: input.kind, title: input.title, body: input.body, link: input.link },
  });
}

const STAFF_ROLES: Role[] = ["MANAGER", "ADMIN", "SUPER_ADMIN"];

export const notifyStaff = (input: NotifyInput, db: Db = prisma) =>
  notifyRoles(["MANAGER", ...(["ADMIN"] as Role[])], input, db);

export async function notifyNewBooking(
  reference: string,
  routeLabel: string,
  db: Db = prisma
): Promise<void> {
  await notifyRoles(
    STAFF_ROLES,
    {
      kind: "booking_new",
      title: `Нове бронювання ${reference}`,
      body: routeLabel,
      link: `/cabinet/tickets/${reference}`,
    },
    db
  );
}

export async function notifyPaymentReceived(
  reference: string,
  amount: number,
  db: Db = prisma
): Promise<void> {
  await notifyRoles(
    [...STAFF_ROLES, "ACCOUNTANT"],
    {
      kind: "payment_received",
      title: `Оплату отримано ${reference}`,
      body: `€${amount.toFixed(2)}`,
      link: `/cabinet/tickets/${reference}`,
    },
    db
  );
}

export async function notifyRefundRequested(
  reference: string,
  db: Db = prisma
): Promise<void> {
  await notifyRoles(
    [...STAFF_ROLES, "ACCOUNTANT"],
    {
      kind: "refund_requested",
      title: `Клієнт запросив повернення ${reference}`,
      link: `/cabinet/tickets/${reference}`,
    },
    db
  );
}

export async function notifySeatFreed(
  reference: string,
  seatNumber: number | null,
  db: Db = prisma
): Promise<void> {
  await notifyRoles(
    STAFF_ROLES,
    {
      kind: "seat_freed",
      title: `Місце звільнилося${seatNumber != null ? ` №${seatNumber}` : ""}`,
      body: reference,
      link: `/cabinet/tickets/${reference}`,
    },
    db
  );
}

export async function notifyTripAlmostFull(
  tripLabel: string,
  soldRatio: number,
  db: Db = prisma
): Promise<void> {
  await notifyRoles(
    STAFF_ROLES,
    {
      kind: "trip_almost_full",
      title: "Рейс майже заповнений",
      body: `${tripLabel} · продано ${Math.round(soldRatio * 100)}% місць`,
    },
    db
  );
}

export async function notifyScheduleChanged(
  detail: string,
  db: Db = prisma
): Promise<void> {
  await notifyRoles(
    [...STAFF_ROLES, "DISPATCHER"],
    { kind: "schedule_changed", title: "Змінився час відправлення", body: detail },
    db
  );
}

/**
 * Lazy "не оплачено 10 хвилин" alerts: created once per ticket when the
 * notification list is fetched.
 */
export async function sweepUnpaidTickets(db: Db = prisma): Promise<void> {
  const cutoff = new Date(Date.now() - 10 * 60_000);
  const stale = await db.ticket.findMany({
    where: { status: "AWAITING_PAYMENT", createdAt: { lte: cutoff } },
    include: { booking: { select: { reference: true } } },
    take: 20,
  });
  for (const ticket of stale) {
    const reference = ticket.booking?.reference;
    if (!reference) continue;
    const link = `/cabinet/tickets/${reference}`;
    const existing = await db.notification.findFirst({
      where: { kind: "unpaid_10m", link },
    });
    if (existing) continue;
    await notifyRoles(
      STAFF_ROLES,
      {
        kind: "unpaid_10m",
        title: `Не оплачено 10 хвилин — ${reference}`,
        link,
      },
      db
    );
  }
}
