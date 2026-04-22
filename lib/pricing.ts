/**
 * Pricing helpers used both by the BookingForm (for the live price preview)
 * and by the server (validation / final charge will move here later).
 */

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
 * Mock promo codes. Replace with a DB-backed table / promo service when the
 * admin UI for promotions lands.
 */
export type PromoCode = {
  code: string;
  discount: number;
  label: string;
};

export const MOCK_PROMO_CODES: ReadonlyArray<PromoCode> = [
  { code: "SUMMER10", discount: 0.1, label: "Summer 2026 · -10%" },
  { code: "STUDENT15", discount: 0.15, label: "Student · -15%" },
  { code: "ASOL20", discount: 0.2, label: "Launch offer · -20%" },
];

export type PromoCheck =
  | { status: "empty" }
  | { status: "valid"; promo: PromoCode }
  | { status: "invalid"; input: string };

export function checkPromo(raw: string): PromoCheck {
  const code = raw.trim().toUpperCase();
  if (!code) return { status: "empty" };
  const promo = MOCK_PROMO_CODES.find((p) => p.code === code);
  if (promo) return { status: "valid", promo };
  return { status: "invalid", input: code };
}

export const SERVICE_FEE_EUR = 1.5;

export type PriceBreakdown = {
  basePrice: number;
  ageDiscount: number;
  promoDiscount: number;
  finalPrice: number;
  serviceFee: number;
  total: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computePrice(
  basePrice: number,
  ageId: AgeCategoryId,
  promo?: PromoCode | null
): PriceBreakdown {
  const age = getAgeCategory(ageId);
  const ageDiscount = r2(basePrice * age.discount);
  const afterAge = r2(basePrice - ageDiscount);
  const promoDiscount = r2(afterAge * (promo?.discount ?? 0));
  const finalPrice = r2(afterAge - promoDiscount);
  const serviceFee = SERVICE_FEE_EUR;
  const total = r2(finalPrice + serviceFee);
  return {
    basePrice: r2(basePrice),
    ageDiscount,
    promoDiscount,
    finalPrice,
    serviceFee,
    total,
  };
}
