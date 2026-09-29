import type { Prisma, PrismaClient, Role } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Notification Center. Role-targeted rows are read by everyone with that
 * role (or higher staff); user-targeted rows are personal. Per-event rules
 * (enabled, target roles, thresholds) are editable in settings.
 */
export type NotifyInput = {
  kind: string;
  title: string;
  body?: string;
  link?: string;
};

type Db = PrismaClient | Prisma.TransactionClient;

export const NOTIFICATION_EVENTS: {
  kind: string;
  label: string;
  defaultRoles: Role[];
  thresholdLabel?: string;
  defaultThresholdMin?: number;
}[] = [
  { kind: "booking_new", label: "Нове бронювання", defaultRoles: ["MANAGER", "ADMIN"] },
  { kind: "unpaid_10m", label: "Не оплачено вчасно", defaultRoles: ["MANAGER", "ADMIN"], thresholdLabel: "хвилин без оплати", defaultThresholdMin: 10 },
  { kind: "seat_freed", label: "Місце звільнилося", defaultRoles: ["MANAGER", "ADMIN"] },
  { kind: "trip_almost_full", label: "Рейс майже заповнений", defaultRoles: ["MANAGER", "ADMIN"] },
  { kind: "schedule_changed", label: "Змінився час відправлення", defaultRoles: ["MANAGER", "ADMIN", "DISPATCHER"] },
  { kind: "refund_requested", label: "Клієнт запросив повернення", defaultRoles: ["MANAGER", "ADMIN", "ACCOUNTANT"] },
  { kind: "payment_received", label: "Оплату отримано", defaultRoles: ["MANAGER", "ADMIN", "ACCOUNTANT"] },
];

export async function seedNotificationRules(db: Db = prisma): Promise<void> {
  for (const event of NOTIFICATION_EVENTS) {
    await db.notificationRule.upsert({
      where: { kind: event.kind },
      create: {
        kind: event.kind,
        enabled: true,
        roles: JSON.stringify(event.defaultRoles),
        thresholdMin: event.defaultThresholdMin ?? null,
      },
      update: {},
    });
  }
}

type Rule = { enabled: boolean; roles: Role[]; thresholdMin: number | null };

async function getRule(kind: string, db: Db): Promise<Rule> {
  const row = await db.notificationRule.findUnique({ where: { kind } });
  if (!row) {
    const def = NOTIFICATION_EVENTS.find((e) => e.kind === kind);
    return {
      enabled: true,
      roles: def?.defaultRoles ?? ["ADMIN"],
      thresholdMin: def?.defaultThresholdMin ?? null,
    };
  }
  try {
    return {
      enabled: row.enabled,
      roles: (JSON.parse(row.roles) as Role[]) ?? [],
      thresholdMin: row.thresholdMin,
    };
  } catch {
    return { enabled: row.enabled, roles: ["ADMIN"], thresholdMin: row.thresholdMin };
  }
}

export async function notifyRoles(
  roles: Role[],
  input: NotifyInput,
  db: Db = prisma
): Promise<void> {
  const rule = await getRule(input.kind, db);
  if (!rule.enabled) return;
  const targets = rule.roles.length ? rule.roles : roles;
  for (const role of [...new Set(targets)]) {
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
  const rule = await getRule("unpaid_10m", db);
  if (!rule.enabled) return;
  const minutes = rule.thresholdMin ?? 10;
  const cutoff = new Date(Date.now() - minutes * 60_000);
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
