import { Prisma, SettlementStatus, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveCommission } from "@/lib/commission";

/**
 * Monthly carrier settlements.
 *
 * Business rule: for every ticket sold on a carrier's trip, the agency keeps
 * `commissionAmount` and the carrier is due `carrierAmount`. On the 7th of
 * each month a Settlement is generated per carrier for the previous calendar
 * month, together with an invoice (рахунок) and an act (акт).
 *
 * Payment point: where the passenger's money actually landed.
 *   PAID_ONLINE → collected by the agency  → we owe the carrier its share
 *   PAID_CASH   → collected by the carrier → the carrier owes us commission
 *   RESERVED    → not paid yet             → reported, but outside the balance
 * The net balance (balanceAmount + balanceDirection) says who owes whom.
 */

/** Ticket statuses that count as a sale (cancelled/refunded are excluded). */
export const SELLABLE_STATUSES: TicketStatus[] = [
  TicketStatus.RESERVED,
  TicketStatus.PAID_ONLINE,
  TicketStatus.PAID_CASH,
];

export type BalanceDirection = "TO_CARRIER" | "TO_AGENT" | "ZERO";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** "YYYY-MM" of the calendar month before the given date. */
export function previousPeriod(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return formatPeriod(d);
}

export function formatPeriod(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isValidPeriod(period: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(period);
}

/** [start, end) UTC range covered by a YYYY-MM period. */
export function periodRange(period: string): { start: Date; end: Date } {
  const [y, m] = period.split("-").map((v) => Number.parseInt(v, 10));
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}

export type MoneySplit = {
  collectedByAgent: number;
  collectedByCarrier: number;
  unpaidAmount: number;
  balanceAmount: number;
  balanceDirection: BalanceDirection;
};

/**
 * Compute the payment-point split and net balance for a set of tickets.
 *   balance = (carrier share of agent-collected sales)
 *           − (agency commission of carrier-collected sales)
 */
export function computeSplit(
  tickets: {
    status: TicketStatus;
    finalPrice: number;
    commissionAmount: number | null;
    carrierAmount: number | null;
  }[]
): MoneySplit {
  let collectedByAgent = 0;
  let collectedByCarrier = 0;
  let unpaidAmount = 0;
  let oweCarrier = 0; // carrier share of money we collected
  let oweAgent = 0; // our commission on money the carrier collected

  for (const t of tickets) {
    if (t.status === TicketStatus.PAID_ONLINE) {
      collectedByAgent += t.finalPrice;
      oweCarrier += t.carrierAmount ?? 0;
    } else if (t.status === TicketStatus.PAID_CASH) {
      collectedByCarrier += t.finalPrice;
      oweAgent += t.commissionAmount ?? 0;
    } else {
      unpaidAmount += t.finalPrice;
    }
  }

  const net = round2(oweCarrier - oweAgent);
  return {
    collectedByAgent: round2(collectedByAgent),
    collectedByCarrier: round2(collectedByCarrier),
    unpaidAmount: round2(unpaidAmount),
    balanceAmount: Math.abs(net),
    balanceDirection: net > 0 ? "TO_CARRIER" : net < 0 ? "TO_AGENT" : "ZERO",
  };
}

export type CarrierReportRow = MoneySplit & {
  carrierId: string;
  carrierName: string;
  ticketCount: number;
  grossAmount: number;
  commissionAmount: number;
  carrierAmount: number;
  /** True once these sales are locked into a Settlement. */
  settled: boolean;
  settlementId?: string;
  settlementStatus?: SettlementStatus;
  invoiceNumber?: string;
};

/**
 * Live per-carrier sales report for a period — regardless of whether a
 * settlement has been generated yet. Shows the payment-point split and the
 * net balance direction per carrier.
 */
export async function getPeriodReport(period: string): Promise<CarrierReportRow[]> {
  const { start, end } = periodRange(period);

  const tickets = await prisma.ticket.findMany({
    where: {
      status: { in: SELLABLE_STATUSES },
      createdAt: { gte: start, lt: end },
    },
    select: {
      status: true,
      finalPrice: true,
      commissionAmount: true,
      carrierAmount: true,
      trip: {
        select: {
          carrierId: true,
          carrier: { select: { name: true } },
        },
      },
    },
  });

  const settlements = await prisma.settlement.findMany({
    where: { period },
    select: { id: true, carrierId: true, status: true, invoiceNumber: true },
  });
  const settlementByCarrier = new Map(settlements.map((s) => [s.carrierId, s]));

  const byCarrier = new Map<
    string,
    { carrierName: string; tickets: typeof tickets }
  >();
  for (const t of tickets) {
    if (!t.trip) continue;
    const entry = byCarrier.get(t.trip.carrierId) ?? {
      carrierName: t.trip.carrier.name,
      tickets: [],
    };
    entry.tickets.push(t);
    byCarrier.set(t.trip.carrierId, entry);
  }

  const rows: CarrierReportRow[] = [];
  for (const [carrierId, data] of byCarrier) {
    const split = computeSplit(data.tickets);
    const settlement = settlementByCarrier.get(carrierId);
    rows.push({
      carrierId,
      carrierName: data.carrierName,
      ticketCount: data.tickets.length,
      grossAmount: round2(data.tickets.reduce((s, t) => s + t.finalPrice, 0)),
      commissionAmount: round2(
        data.tickets.reduce((s, t) => s + (t.commissionAmount ?? 0), 0)
      ),
      carrierAmount: round2(
        data.tickets.reduce((s, t) => s + (t.carrierAmount ?? 0), 0)
      ),
      ...split,
      settled: Boolean(settlement),
      settlementId: settlement?.id,
      settlementStatus: settlement?.status,
      invoiceNumber: settlement?.invoiceNumber,
    });
  }

  return rows.sort((a, b) => a.carrierName.localeCompare(b.carrierName));
}

export type GeneratedSettlement = {
  id: string;
  carrierId: string;
  carrierName: string;
  period: string;
  ticketCount: number;
  grossAmount: number;
  commissionAmount: number;
  carrierAmount: number;
  balanceAmount: number;
  balanceDirection: BalanceDirection;
  invoiceNumber: string;
  actNumber: string;
};

/**
 * Generate settlements for every carrier with unsettled sales in the period.
 * Carriers that already have a settlement for the period are skipped
 * (idempotent — safe to re-run from cron). Records a GENERATED event per
 * settlement for the calculation history.
 */
export async function generateSettlements(
  period: string,
  actor = "system"
): Promise<GeneratedSettlement[]> {
  if (!isValidPeriod(period)) {
    throw new Error(`Invalid period "${period}" — expected YYYY-MM`);
  }
  const { start, end } = periodRange(period);

  // Unsettled sellable tickets of the period, with their carrier.
  const tickets = await prisma.ticket.findMany({
    where: {
      status: { in: SELLABLE_STATUSES },
      createdAt: { gte: start, lt: end },
      settlementId: null,
      tripId: { not: null },
    },
    select: {
      id: true,
      status: true,
      finalPrice: true,
      commissionAmount: true,
      carrierAmount: true,
      trip: {
        select: {
          carrierId: true,
          fromCity: true,
          toCity: true,
          carrier: { select: { name: true } },
        },
      },
    },
  });

  // Backfill commission for legacy tickets sold before the commission
  // snapshot existed — resolve it now from the current rules so the carrier
  // payout is not silently zero.
  for (const t of tickets) {
    if (t.commissionAmount == null && t.trip) {
      const split = await resolveCommission(
        prisma,
        t.trip.carrierId,
        t.trip.fromCity,
        t.trip.toCity,
        t.finalPrice
      );
      await prisma.ticket.update({
        where: { id: t.id },
        data: {
          commissionPercent: split.percent,
          commissionAmount: split.commissionAmount,
          carrierAmount: split.carrierAmount,
        },
      });
      t.commissionAmount = split.commissionAmount;
      t.carrierAmount = split.carrierAmount;
    }
  }

  const byCarrier = new Map<
    string,
    { carrierName: string; tickets: typeof tickets }
  >();
  for (const t of tickets) {
    if (!t.trip) continue;
    const entry = byCarrier.get(t.trip.carrierId) ?? {
      carrierName: t.trip.carrier.name,
      tickets: [],
    };
    entry.tickets.push(t);
    byCarrier.set(t.trip.carrierId, entry);
  }

  // Skip carriers that already have a settlement for this period — their
  // unsettled tickets (sold after invoicing) wait for the next period or a
  // manual regeneration. Keeps generation idempotent instead of violating
  // the (carrierId, period) unique constraint.
  const alreadySettled = await prisma.settlement.findMany({
    where: { period, carrierId: { in: [...byCarrier.keys()] } },
    select: { carrierId: true },
  });
  for (const s of alreadySettled) {
    byCarrier.delete(s.carrierId);
  }

  // Continue the invoice numbering sequence for this period.
  const existingCount = await prisma.settlement.count({ where: { period } });

  const generated: GeneratedSettlement[] = [];
  let seq = existingCount;
  for (const [carrierId, data] of byCarrier) {
    seq += 1;
    const suffix = String(seq).padStart(4, "0");
    const invoiceNumber = `INV-${period}-${suffix}`;
    const actNumber = `ACT-${period}-${suffix}`;
    const split = computeSplit(data.tickets);
    const gross = round2(data.tickets.reduce((s, t) => s + t.finalPrice, 0));
    const commission = round2(
      data.tickets.reduce((s, t) => s + (t.commissionAmount ?? 0), 0)
    );
    const payout = round2(
      data.tickets.reduce((s, t) => s + (t.carrierAmount ?? 0), 0)
    );

    const settlement = await prisma.$transaction(async (tx) => {
      const created = await tx.settlement.create({
        data: {
          period,
          carrierId,
          ticketCount: data.tickets.length,
          grossAmount: gross,
          commissionAmount: commission,
          carrierAmount: payout,
          collectedByAgent: split.collectedByAgent,
          collectedByCarrier: split.collectedByCarrier,
          unpaidAmount: split.unpaidAmount,
          balanceAmount: split.balanceAmount,
          balanceDirection: split.balanceDirection,
          invoiceNumber,
          actNumber,
        },
      });
      await tx.ticket.updateMany({
        where: { id: { in: data.tickets.map((t) => t.id) } },
        data: { settlementId: created.id },
      });
      await tx.settlementEvent.create({
        data: {
          settlementId: created.id,
          action: "GENERATED",
          actor,
          details: JSON.stringify({
            ticketCount: created.ticketCount,
            grossAmount: gross,
            balanceAmount: split.balanceAmount,
            balanceDirection: split.balanceDirection,
          }),
        },
      });
      return created;
    });

    generated.push({
      id: settlement.id,
      carrierId,
      carrierName: data.carrierName,
      period,
      ticketCount: settlement.ticketCount,
      grossAmount: settlement.grossAmount,
      commissionAmount: settlement.commissionAmount,
      carrierAmount: settlement.carrierAmount,
      balanceAmount: settlement.balanceAmount,
      balanceDirection: settlement.balanceDirection as BalanceDirection,
      invoiceNumber,
      actNumber,
    });
  }

  return generated;
}

export async function listSettlements(period?: string) {
  return prisma.settlement.findMany({
    where: period ? { period } : undefined,
    include: {
      carrier: { select: { name: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
    orderBy: [{ period: "desc" }, { carrier: { name: "asc" } }],
    take: 200,
  });
}

/** Recent settlement events across all carriers — the calculation history. */
export async function getSettlementHistory(limit = 50) {
  return prisma.settlementEvent.findMany({
    include: {
      settlement: {
        select: {
          period: true,
          invoiceNumber: true,
          carrier: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/** Line items of a settlement, grouped by route for the invoice/act tables. */
export async function getSettlementLines(settlementId: string) {
  const settlement = await prisma.settlement.findUnique({
    where: { id: settlementId },
    include: {
      carrier: true,
      tickets: {
        include: { trip: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!settlement) return null;

  const byRoute = new Map<
    string,
    { route: string; transportType: string; count: number; gross: number; commission: number; payout: number }
  >();
  for (const t of settlement.tickets) {
    const route = t.trip ? `${t.trip.fromCity} → ${t.trip.toCity}` : "—";
    const transportType = t.trip?.transportType ?? "BUS";
    const key = `${transportType}|${route}`;
    const line = byRoute.get(key) ?? {
      route,
      transportType,
      count: 0,
      gross: 0,
      commission: 0,
      payout: 0,
    };
    line.count += 1;
    line.gross += t.finalPrice;
    line.commission += t.commissionAmount ?? 0;
    line.payout += t.carrierAmount ?? 0;
    byRoute.set(key, line);
  }

  return {
    settlement,
    lines: [...byRoute.values()].map((l) => ({
      ...l,
      gross: round2(l.gross),
      commission: round2(l.commission),
      payout: round2(l.payout),
    })),
  };
}

/**
 * Mark a settlement as sent to the carrier and record a SENT event.
 *
 * NOTE: actual email delivery is intentionally a stub — wire SMTP (env
 * SMTP_URL) or a transactional email provider here. The status transition
 * and timestamp are recorded either way so the audit trail is complete.
 */
export async function markSettlementSent(settlementId: string, actor = "system") {
  return prisma.$transaction(async (tx) => {
    const settlement = await tx.settlement.update({
      where: { id: settlementId },
      data: { status: SettlementStatus.SENT, sentAt: new Date() },
    });
    await tx.settlementEvent.create({
      data: { settlementId, action: "SENT", actor },
    });
    return settlement;
  });
}

/**
 * Mark a settlement as paid (money transferred) and record a PAID event.
 * Allowed from GENERATED or SENT; a second call is a no-op error.
 */
export async function markSettlementPaid(settlementId: string, actor = "system") {
  return prisma.$transaction(async (tx) => {
    const current = await tx.settlement.findUnique({ where: { id: settlementId } });
    if (!current) throw new Error("Settlement not found");
    if (current.status === SettlementStatus.PAID) {
      throw new Error("Settlement is already paid");
    }
    const settlement = await tx.settlement.update({
      where: { id: settlementId },
      data: { status: SettlementStatus.PAID, paidAt: new Date() },
    });
    await tx.settlementEvent.create({
      data: {
        settlementId,
        action: "PAID",
        actor,
        details: JSON.stringify({
          balanceAmount: current.balanceAmount,
          balanceDirection: current.balanceDirection,
        }),
      },
    });
    return settlement;
  });
}

export { Prisma };
