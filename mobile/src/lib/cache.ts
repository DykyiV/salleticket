import { deleteItem, getJson, setJson } from "@/lib/storage";
import type { MyOrders, OrderTickets } from "@/lib/types";

/**
 * Offline copies of «Мої квитки» and opened tickets, so the QR code still
 * shows at a boarding point without signal. Wiped on sign-out.
 */

const ORDERS_KEY = "gt_orders";
const REFS_KEY = "gt_ticket_refs";
const MAX_TICKETS = 30;

const ticketKey = (reference: string) => `gt_ticket_${reference.replace(/[^A-Za-z0-9_-]/g, "")}`;

export type Cached<T> = { data: T; savedAt: string };

export async function saveOrders(data: MyOrders): Promise<void> {
  await setJson(ORDERS_KEY, { data, savedAt: new Date().toISOString() } satisfies Cached<MyOrders>);
}

export function loadOrders(): Promise<Cached<MyOrders> | null> {
  return getJson<Cached<MyOrders>>(ORDERS_KEY);
}

export async function saveTicket(reference: string, data: OrderTickets): Promise<void> {
  await setJson(ticketKey(reference), { data, savedAt: new Date().toISOString() } satisfies Cached<OrderTickets>);
  const refs = ((await getJson<string[]>(REFS_KEY)) ?? []).filter((r) => r !== reference);
  refs.unshift(reference);
  const dropped = refs.splice(MAX_TICKETS);
  await Promise.all([setJson(REFS_KEY, refs), ...dropped.map((r) => deleteItem(ticketKey(r)))]);
}

export function loadTicket(reference: string): Promise<Cached<OrderTickets> | null> {
  return getJson<Cached<OrderTickets>>(ticketKey(reference));
}

export async function clearCache(): Promise<void> {
  const refs = (await getJson<string[]>(REFS_KEY)) ?? [];
  await Promise.all([deleteItem(ORDERS_KEY), deleteItem(REFS_KEY), ...refs.map((r) => deleteItem(ticketKey(r)))]);
}
