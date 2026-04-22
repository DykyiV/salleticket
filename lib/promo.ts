/**
 * Promo code registry + lookup.
 *
 * The registry is intentionally a plain list so the same API can later be
 * backed by:
 *   - a Prisma `Promo` table maintained by admins,
 *   - a feature-flag service (time-boxed campaigns),
 *   - a remote partner endpoint.
 *
 * Code shape is normalised to UPPERCASE on read.
 */

export type PromoDiscount =
  | { type: "percent"; percent: number } // 0..1 of the price after age discount
  | { type: "fixed"; amount: number; currency: "EUR" };

export type Promo = {
  code: string;
  label: string;
  discount: PromoDiscount;
  /** Optional validity window — null/undefined means "always on". */
  startsAt?: Date | null;
  endsAt?: Date | null;
};

/**
 * Built-in promo codes. Add or remove entries here; the rest of the app picks
 * them up automatically.
 */
export const PROMO_CODES: ReadonlyArray<Promo> = [
  {
    code: "DISCOUNT10",
    label: "10% off",
    discount: { type: "percent", percent: 0.1 },
  },
  {
    code: "VIP20",
    label: "VIP · 20% off",
    discount: { type: "percent", percent: 0.2 },
  },
];

/**
 * Case-insensitive lookup. Ignores promos outside their [startsAt, endsAt)
 * window so time-boxed campaigns just work.
 */
export function findPromo(raw: string | null | undefined, now: Date = new Date()): Promo | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  if (!code) return null;
  const promo = PROMO_CODES.find((p) => p.code === code);
  if (!promo) return null;
  if (promo.startsAt && now < promo.startsAt) return null;
  if (promo.endsAt && now >= promo.endsAt) return null;
  return promo;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Returns the monetary discount promo would apply to `priceBeforePromo`
 * (typically the price *after* the age-category discount). Never drops below 0.
 */
export function promoDiscountAmount(
  priceBeforePromo: number,
  promo: Promo | null | undefined
): number {
  if (!promo) return 0;
  if (promo.discount.type === "percent") {
    return round2(priceBeforePromo * promo.discount.percent);
  }
  return round2(Math.min(promo.discount.amount, priceBeforePromo));
}

export type PromoCheck =
  | { status: "empty" }
  | { status: "valid"; promo: Promo }
  | { status: "invalid"; input: string };

export function checkPromo(raw: string, now: Date = new Date()): PromoCheck {
  if (!raw || !raw.trim()) return { status: "empty" };
  const promo = findPromo(raw, now);
  if (promo) return { status: "valid", promo };
  return { status: "invalid", input: raw.trim().toUpperCase() };
}

/** UI helper — string like "-10%" or "-€5.00". */
export function promoBadge(promo: Promo): string {
  if (promo.discount.type === "percent") {
    return `-${Math.round(promo.discount.percent * 100)}%`;
  }
  return `-€${promo.discount.amount.toFixed(2)}`;
}
