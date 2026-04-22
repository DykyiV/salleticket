/**
 * Promo code service.
 *
 * Promos live in the `promos` table. Validation rules (see validatePromo):
 *   1. code matches a row (case-insensitive)
 *   2. isActive === true
 *   3. now is inside [startsAt, endsAt)
 *   4. usedCount < usageLimit (or usageLimit is null = unlimited)
 *   5. if promo.userId is set, it must equal the current user's id
 */

import type { Promo as DbPromo, PrismaClient } from "@prisma/client";

export type Promo = DbPromo;

/** Typed error so API handlers can map each failure to a clean message. */
export type PromoErrorReason =
  | "missing"
  | "not_found"
  | "inactive"
  | "not_started"
  | "expired"
  | "usage_limit_reached"
  | "wrong_user";

export class PromoError extends Error {
  readonly reason: PromoErrorReason;
  constructor(reason: PromoErrorReason, message: string) {
    super(message);
    this.name = "PromoError";
    this.reason = reason;
  }
}

/**
 * Case-insensitive code lookup. Returns the raw row (no validity checks).
 * Use validatePromo to run the full rule set.
 */
export async function findPromo(
  db: PrismaClient | Pick<PrismaClient, "promo">,
  rawCode: string | null | undefined
): Promise<Promo | null> {
  if (!rawCode || !rawCode.trim()) return null;
  const code = rawCode.trim().toUpperCase();
  return db.promo.findUnique({ where: { code } });
}

type ValidateArgs = {
  rawCode: string | null | undefined;
  currentUserId: string | null;
  now?: Date;
};

/**
 * Full rule evaluation. Returns the matching Promo or throws PromoError.
 */
export async function validatePromo(
  db: PrismaClient | Pick<PrismaClient, "promo">,
  { rawCode, currentUserId, now = new Date() }: ValidateArgs
): Promise<Promo> {
  if (!rawCode || !rawCode.trim()) {
    throw new PromoError("missing", "Promo code is required");
  }

  const promo = await findPromo(db, rawCode);
  if (!promo) {
    throw new PromoError("not_found", "Promo code not found");
  }

  if (!promo.isActive) {
    throw new PromoError("inactive", "Promo code is not active");
  }

  if (promo.startsAt && now < promo.startsAt) {
    throw new PromoError("not_started", "Promo code is not active yet");
  }
  if (promo.endsAt && now >= promo.endsAt) {
    throw new PromoError("expired", "Promo code has expired");
  }

  if (promo.usageLimit != null && promo.usedCount >= promo.usageLimit) {
    throw new PromoError(
      "usage_limit_reached",
      "Promo code has reached its usage limit"
    );
  }

  if (promo.userId && promo.userId !== currentUserId) {
    throw new PromoError(
      "wrong_user",
      "This promo code is not available for this account"
    );
  }

  return promo;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function promoDiscountAmount(
  priceBeforePromo: number,
  promo: Promo | null | undefined
): number {
  if (!promo) return 0;
  return round2(priceBeforePromo * promo.percent);
}

/** UI helper — "-10%" etc. */
export function promoBadge(promo: Promo): string {
  return `-${Math.round(promo.percent * 100)}%`;
}
