/**
 * Discount cards: persistent, reusable per-customer discounts (as opposed to
 * Promo, which is a single campaign code, often time/usage-limited). A card
 * is issued once — manually by an admin, or automatically as a referral
 * welcome gift / reward — and applies its percent discount to every booking
 * that redeems it, with no expiry or usage cap.
 *
 * A booking may redeem a promo code OR a discount card, not both — see the
 * doc comment on Booking.discountCardCode in prisma/schema.prisma.
 */

import type { DiscountCard as DbDiscountCard, PrismaClient } from "@prisma/client";

export type DiscountCard = DbDiscountCard;

export type DiscountCardErrorReason = "missing" | "not_found" | "inactive" | "wrong_user";

export class DiscountCardError extends Error {
  readonly reason: DiscountCardErrorReason;
  constructor(reason: DiscountCardErrorReason, message: string) {
    super(message);
    this.name = "DiscountCardError";
    this.reason = reason;
  }
}

export async function findDiscountCard(
  db: Pick<PrismaClient, "discountCard">,
  rawCode: string | null | undefined
): Promise<DiscountCard | null> {
  if (!rawCode || !rawCode.trim()) return null;
  return db.discountCard.findUnique({ where: { code: rawCode.trim().toUpperCase() } });
}

/** Full rule evaluation. Returns the matching card or throws DiscountCardError. */
export async function validateDiscountCard(
  db: Pick<PrismaClient, "discountCard">,
  { rawCode, currentUserId }: { rawCode: string | null | undefined; currentUserId: string | null }
): Promise<DiscountCard> {
  if (!rawCode || !rawCode.trim()) {
    throw new DiscountCardError("missing", "Discount card code is required");
  }
  const card = await findDiscountCard(db, rawCode);
  if (!card) throw new DiscountCardError("not_found", "Discount card not found");
  if (!card.isActive) throw new DiscountCardError("inactive", "Discount card is not active");
  // A card bound to a user (the normal case — manual issue or referral
  // reward always assigns an owner) may only be redeemed by that user.
  // An unassigned card (userId null) is redeemable by anyone who has the
  // code, same as a promo with no userId.
  if (card.userId && card.userId !== currentUserId) {
    throw new DiscountCardError(
      "wrong_user",
      "This discount card is not available for this account"
    );
  }
  return card;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function discountCardAmount(priceBeforeDiscount: number, card: DiscountCard | null | undefined): number {
  if (!card) return 0;
  return round2(priceBeforeDiscount * card.percent);
}

function randomCode(): string {
  return `DC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/**
 * Issue a new discount card to a user. Retries on the (extremely unlikely)
 * random-code collision.
 */
export async function issueDiscountCard(
  db: Pick<PrismaClient, "discountCard">,
  args: { userId: string; percent: number; source: string }
): Promise<DiscountCard> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.discountCard.create({
        data: {
          code: randomCode(),
          percent: args.percent,
          userId: args.userId,
          source: args.source,
        },
      });
    } catch (err) {
      const isUniqueClash =
        err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002";
      if (!isUniqueClash || attempt === 4) throw err;
    }
  }
  throw new Error("Failed to issue discount card after retries");
}
