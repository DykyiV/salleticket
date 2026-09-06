import type { PrismaClient } from "@prisma/client";

const DEFAULT_ID = "default";

export type RefundPolicyValues = {
  cashRefundPercent: number;
  onlineRefundPercent: number;
};

const FALLBACK: RefundPolicyValues = {
  cashRefundPercent: 0.8,
  onlineRefundPercent: 0.8,
};

/** Reads the singleton refund policy row, falling back to the hardcoded
 * 80/20 default if an admin has never saved one. */
export async function getRefundPolicy(
  db: Pick<PrismaClient, "refundPolicy">
): Promise<RefundPolicyValues> {
  const row = await db.refundPolicy.findUnique({ where: { id: DEFAULT_ID } });
  if (!row) return FALLBACK;
  return {
    cashRefundPercent: row.cashRefundPercent,
    onlineRefundPercent: row.onlineRefundPercent,
  };
}

export async function setRefundPolicy(
  db: Pick<PrismaClient, "refundPolicy">,
  values: RefundPolicyValues
): Promise<RefundPolicyValues> {
  const row = await db.refundPolicy.upsert({
    where: { id: DEFAULT_ID },
    create: { id: DEFAULT_ID, ...values },
    update: values,
  });
  return { cashRefundPercent: row.cashRefundPercent, onlineRefundPercent: row.onlineRefundPercent };
}
