import { prisma } from "@/lib/db";
import { ETICKET_INCLUDE, toETicket, type ETicket, type ETicketState } from "@/lib/tickets/eTicket";

/**
 * «Мої квитки»: a passenger's orders, grouped and split into upcoming and
 * past. One source for the site page and the mobile app, so both always show
 * the same list.
 */

export type MyOrder = {
  key: string;
  tickets: ETicket[];
  departAt: string | null;
  state: ETicketState;
  total: number;
};

export type MyOrders = { upcoming: MyOrder[]; past: MyOrder[] };

const RANK: Record<ETicketState, number> = { due: 0, pending: 1, paid: 2, refunded: 3, cancelled: 4 };

export function todayInEurope(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(now);
}

/** Group e-tickets into orders and split them by the last travel day. */
export function groupOrders(eTickets: ETicket[], today: string): MyOrders {
  const byKey = new Map<string, ETicket[]>();
  for (const e of eTickets) {
    const key = e.groupRef ?? e.reference;
    byKey.set(key, [...(byKey.get(key) ?? []), e]);
  }
  const upcoming: MyOrder[] = [];
  const past: MyOrder[] = [];
  for (const [key, tickets] of byKey) {
    tickets.sort((a, b) => a.reference.localeCompare(b.reference));
    const live = tickets.filter((e) => e.state !== "cancelled" && e.state !== "refunded");
    const departAt = tickets[0].journeys[0]?.departAt ?? null;
    const state = (live.length ? live : tickets).reduce<ETicketState>((s, e) => (RANK[e.state] < RANK[s] ? e.state : s), "cancelled");
    const order: MyOrder = { key, tickets, departAt, state, total: live.reduce((sum, e) => sum + e.price, 0) };
    const lastDay = tickets[0].journeys.at(-1)?.departAt?.slice(0, 10) ?? departAt?.slice(0, 10) ?? today;
    if (live.length && lastDay >= today) upcoming.push(order);
    else past.push(order);
  }
  upcoming.sort((a, b) => (a.departAt ?? "").localeCompare(b.departAt ?? ""));
  past.sort((a, b) => (b.departAt ?? "").localeCompare(a.departAt ?? ""));
  return { upcoming, past };
}

/** The signed-in passenger's orders (tickets bought on their account). */
export async function loadMyOrders(userId: string, origin: string, today: string = todayInEurope()): Promise<MyOrders> {
  const rows = await prisma.booking.findMany({
    where: { ticket: { userId } },
    include: ETICKET_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return groupOrders(
    rows.map((b) => toETicket(b, origin)),
    today
  );
}
