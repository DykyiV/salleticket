/**
 * Shapes of the site's API answers (mirrors lib/tickets/eTicket.ts and
 * lib/tickets/myOrders.ts on the server; the smoke tests check the contract).
 */

export type ETicketState = "due" | "pending" | "paid" | "cancelled" | "refunded";

export type ETicketLeg = { from: string; to: string; seat: number | null; bus: string | null };

export type ETicketJourney = {
  kind: "outbound" | "return";
  from: string;
  to: string;
  /** Wall-clock "YYYY-MM-DDTHH:MM" at the stop. */
  departAt: string | null;
  arriveAt: string | null;
  boardAddress: string | null;
  boardMap: string | null;
  alightAddress: string | null;
  alightMap: string | null;
  seat: number | null;
  freeSeating: boolean;
  bus: string | null;
  carrier: string | null;
  legs: ETicketLeg[];
};

export type ETicket = {
  reference: string;
  groupRef: string | null;
  status: string;
  state: ETicketState;
  firstName: string;
  lastName: string;
  ageCategory: string;
  email: string | null;
  phone: string;
  price: number;
  toPay: number;
  issuedAt: string;
  tripKind: string;
  openReturn: boolean;
  journeys: ETicketJourney[];
  /** What the QR code encodes — the driver's check page. */
  checkUrl: string;
};

export type MyOrder = {
  key: string;
  tickets: ETicket[];
  departAt: string | null;
  state: ETicketState;
  total: number;
};

export type MyOrders = { upcoming: MyOrder[]; past: MyOrder[] };

export type OrderTickets = { reference: string; tickets: ETicket[] };

export type AppUser = { id: string; email: string; role: string; createdAt: string };

export type SessionAnswer = { user: AppUser; token: string; expiresAt: string };
