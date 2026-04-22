/**
 * Pricing helpers shared by the BookingForm (live price preview) and the API
 * (authoritative final charge).
 *
 * Discount order:  base → age → promo → service fee.
 */

import {
  findPromo,
  promoDiscountAmount,
  type Promo,
} from "@/lib/promo";

export { checkPromo, findPromo, promoBadge } from "@/lib/promo";
export type { Promo, PromoCheck } from "@/lib/promo";

export type AgeCategoryId = "CHILD_0_4" | "CHILD_5_12" | "ADULT" | "SENIOR_60";

export const AGE_CATEGORIES: ReadonlyArray<{
  id: AgeCategoryId;
  label: string;
  /** Discount as a 0..1 fraction off the base price. */
  discount: number;
  description: string;
}> = [
  { id: "CHILD_0_4", label: "0–4 years", discount: 0.3, description: "-30%" },
  { id: "CHILD_5_12", label: "5–12 years", discount: 0.2, description: "-20%" },
  { id: "ADULT", label: "Adult", discount: 0, description: "no discount" },
  { id: "SENIOR_60", label: "60+", discount: 0.1, description: "-10%" },
];

export function getAgeCategory(id: AgeCategoryId) {
  return AGE_CATEGORIES.find((c) => c.id === id) ?? AGE_CATEGORIES[2];
}

/**
 * Discount ratios per age category. Authoritative on the server; the form
 * uses the same values via AGE_CATEGORIES to preview the price.
 *
 * CHILD_0_4  → 30%
 * CHILD_5_12 → 20%
 * ADULT      → 0%
 * SENIOR_60  → 10%
 */
export const AGE_DISCOUNT: Record<AgeCategoryId, number> = {
  CHILD_0_4: 0.3,
  CHILD_5_12: 0.2,
  ADULT: 0,
  SENIOR_60: 0.1,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Apply the age-category discount to a base price. Promo codes are handled
 * separately (for now, stored without affecting the charge).
 */
export function applyAgeDiscount(
  basePrice: number,
  ageCategory: AgeCategoryId
): { basePrice: number; discount: number; finalPrice: number } {
  const bp = round2(basePrice);
  const rate = AGE_DISCOUNT[ageCategory] ?? 0;
  const discount = round2(bp * rate);
  const finalPrice = round2(bp - discount);
  return { basePrice: bp, discount, finalPrice };
}

export const SERVICE_FEE_EUR = 1.5;

export type PriceBreakdown = {
  basePrice: number;
  ageDiscount: number;
  promoCode?: string;
  promoDiscount: number;
  finalPrice: number;
  serviceFee: number;
  total: number;
};

/**
 * End-to-end price calculation used by the UI preview and the server. Given a
 * base price, age category, and optional promo, returns every intermediate
 * figure so both callers display identical numbers.
 */
export function computePrice(
  basePrice: number,
  ageId: AgeCategoryId,
  promo?: Promo | null
): PriceBreakdown {
  const { basePrice: bp, discount: ageDiscount, finalPrice: afterAge } =
    applyAgeDiscount(basePrice, ageId);
  const promoDiscount = promoDiscountAmount(afterAge, promo ?? null);
  const finalPrice = round2(afterAge - promoDiscount);
  const serviceFee = SERVICE_FEE_EUR;
  const total = round2(finalPrice + serviceFee);
  return {
    basePrice: bp,
    ageDiscount,
    promoCode: promo?.code,
    promoDiscount,
    finalPrice,
    serviceFee,
    total,
  };
}

/**
 * Compute the final ticket price authoritatively from an age category and a
 * raw promo-code string. The server calls this before creating a Booking.
 */
export function computeFinalPrice(
  basePrice: number,
  ageId: AgeCategoryId,
  rawPromoCode?: string | null
): PriceBreakdown & { promo: Promo | null } {
  const promo = findPromo(rawPromoCode ?? null);
  const breakdown = computePrice(basePrice, ageId, promo);
  return { ...breakdown, promo };
}
