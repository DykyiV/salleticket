import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export type CommissionSplit = {
  /** Agency commission, percent 0..100. */
  percent: number;
  /** Agency earnings, EUR — rounded to cents. */
  commissionAmount: number;
  /** Amount payable to the carrier, EUR — rounded to cents. */
  carrierAmount: number;
  /** Where the percent came from (for audit / debugging). */
  source: "ROUTE_RULE" | "CARRIER_DEFAULT";
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Resolve the agency commission for a ticket sale.
 *
 * Priority:
 *   1. Route-specific CommissionRule (carrier + fromCity + toCity)
 *   2. Carrier default commissionPercent
 *
 * The result is snapshotted onto the Ticket row at booking time, so later
 * rule changes never rewrite historical sales.
 */
export async function resolveCommission(
  db: Db,
  carrierId: string,
  fromCity: string,
  toCity: string,
  finalPrice: number
): Promise<CommissionSplit> {
  const rule = await db.commissionRule.findUnique({
    where: {
      carrierId_fromCity_toCity: { carrierId, fromCity, toCity },
    },
  });

  let percent: number;
  let source: CommissionSplit["source"];
  if (rule) {
    percent = rule.percent;
    source = "ROUTE_RULE";
  } else {
    const carrier = await db.carrier.findUnique({
      where: { id: carrierId },
      select: { commissionPercent: true },
    });
    percent = carrier?.commissionPercent ?? 10;
    source = "CARRIER_DEFAULT";
  }

  const commissionAmount = round2((finalPrice * percent) / 100);
  return {
    percent,
    commissionAmount,
    carrierAmount: round2(finalPrice - commissionAmount),
    source,
  };
}
