import { Prisma, SettlementStatus, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveCommission } from "@/lib/commission";

/**
 * Monthly carrier settlements.
 *
 * Business rule: for every ticket sold on a carrier's trip, the agency keeps
 * `commissionAmount` and owes `carrierAmount` to the carrier. On the 7th of
 * each month a Settlement is generated per carrier for the previous calendar
 * month, together with an invoice (рахунок) and an act (акт).
 */

/** Ticket statuses that count as a sale (cancelled/refunded are excluded). */
export const SELLABLE_STATUSES: TicketStatus[] = [
  TicketStatus.RESERVED,
  TicketStatus.PAID_ONLINE,
  TicketStatus.PAID_CASH,
];

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

export type CarrierReportRow = {
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
 * settlement has been generated yet. This is the "10 tickets for €1000 →
 * €800 to the carrier, €200 ours" view.
 */
export async function getPeriodReport(period: string): Promise<CarrierReportRow[]> {
  const { start, end } = periodRange(period);

  const grouped = await prisma.ticket.groupBy({
    by: ["tripId"],
    where: {
      status: { in: SELLABLE_STATUSES },
      createdAt: { gte: start, lt: end },
    },
    _count: { _all: true },
    _sum: { finalPrice: true, commissionAmount: true, carrierAmount: true },
  });

  // Roll trip-level aggregates up to carriers.
  const tripIds = grouped.map((g) => g.tripId).filter((id): id is string => Boolean(id));
  const trips = await prisma.trip.findMany({
    where: { id: { in: tripIds } },
    select: { id: true, carrierId: true, carrier: { select: { name: true } } },
  });
  const tripCarrier = new Map(trips.map((t) => [t.id, t]));

  const settlements = await prisma.settlement.findMany({
    where: { period },
    select: {
      id: true,
      carrierId: true,
      status: true,
      invoiceNumber: true,
    },
  });
  const settlementByCarrier = new Map(settlements.map((s) => [s.carrierId, s]));

  const byCarrier = new Map<string, CarrierReportRow>();
  for (const row of grouped) {
    if (!row.tripId) continue;
    const trip = tripCarrier.get(row.tripId);
    if (!trip) continue;
    const existing = byCarrier.get(trip.carrierId) ?? {
      carrierId: trip.carrierId,
      carrierName: trip.carrier.name,
      ticketCount: 0,
      grossAmount: 0,
      commissionAmount: 0,
      carrierAmount: 0,
      settled: false,
    };
    existing.ticketCount += row._count._all;
    existing.grossAmount = round2(existing.grossAmount + (row._sum.finalPrice ?? 0));
    existing.commissionAmount = round2(
      existing.commissionAmount + (row._sum.commissionAmount ?? 0)
    );
    existing.carrierAmount = round2(
      existing.carrierAmount + (row._sum.carrierAmount ?? 0)
    );
    byCarrier.set(trip.carrierId, existing);
  }

  for (const row of byCarrier.values()) {
    const settlement = settlementByCarrier.get(row.carrierId);
    if (settlement) {
      row.settled = true;
      row.settlementId = settlement.id;
      row.settlementStatus = settlement.status;
      row.invoiceNumber = settlement.invoiceNumber;
    }
  }

  return [...byCarrier.values()].sort((a, b) =>
    a.carrierName.localeCompare(b.carrierName)
  );
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
  invoiceNumber: string;
  actNumber: string;
};

/**
 * Generate settlements for every carrier with unsettled sales in the period.
 * Carriers that already have a settlement for the period are skipped
 * (idempotent — safe to re-run from cron).
 */
export async function generateSettlements(
  period: string
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
    { carrierName: string; ticketIds: string[]; gross: number; commission: number; payout: number }
  >();
  for (const t of tickets) {
    if (!t.trip) continue;
    const entry = byCarrier.get(t.trip.carrierId) ?? {
      carrierName: t.trip.carrier.name,
      ticketIds: [],
      gross: 0,
      commission: 0,
      payout: 0,
    };
    entry.ticketIds.push(t.id);
    entry.gross += t.finalPrice;
    entry.commission += t.commissionAmount ?? 0;
    entry.payout += t.carrierAmount ?? 0;
    byCarrier.set(t.trip.carrierId, entry);
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

    const settlement = await prisma.$transaction(async (tx) => {
      const created = await tx.settlement.create({
        data: {
          period,
          carrierId,
          ticketCount: data.ticketIds.length,
          grossAmount: round2(data.gross),
          commissionAmount: round2(data.commission),
          carrierAmount: round2(data.payout),
          invoiceNumber,
          actNumber,
        },
      });
      await tx.ticket.updateMany({
        where: { id: { in: data.ticketIds } },
        data: { settlementId: created.id },
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
      invoiceNumber,
      actNumber,
    });
  }

  return generated;
}

export async function listSettlements(period?: string) {
  return prisma.settlement.findMany({
    where: period ? { period } : undefined,
    include: { carrier: { select: { name: true } } },
    orderBy: [{ period: "desc" }, { carrier: { name: "asc" } }],
    take: 200,
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
 * Mark a settlement as sent to the carrier.
 *
 * NOTE: actual email delivery is intentionally a stub — wire SMTP (env
 * SMTP_URL) or a transactional email provider here. The status transition
 * and timestamp are recorded either way so the audit trail is complete.
 */
export async function markSettlementSent(settlementId: string) {
  return prisma.settlement.update({
    where: { id: settlementId },
    data: { status: SettlementStatus.SENT, sentAt: new Date() },
  });
}

export { Prisma };
