/**
 * Referral program.
 *
 * Every user gets a stable referral code (lazily provisioned — see
 * getOrCreateReferralCode). Sharing `/register?ref=<code>` and registering
 * sets the new user's `referredByUserId`. Rewards:
 *   - WELCOME: the new (referred) user gets a discount card immediately on
 *     registration.
 *   - REWARD: the referrer gets a discount card once their friend's first
 *     ticket is booked (guarded by `referralRewardGranted` so it only fires
 *     once per referred user).
 *
 * Both rewards reuse the DiscountCard model rather than a separate ledger —
 * simplest way to make the reward immediately useful and visible in the
 * same "your discount cards" UI on /account.
 */

import type { PrismaClient, Prisma } from "@prisma/client";
import { issueDiscountCard } from "@/lib/discountCards";

export const REFERRAL_WELCOME_PERCENT = 0.05; // -5% for the new signup
export const REFERRAL_REWARD_PERCENT = 0.1; // -10% for the referrer

function randomReferralCode(): string {
  return `REF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/** Look up the referrer for a `?ref=` code, if any. Returns null for an unknown/blank code. */
export async function findReferrer(
  db: Pick<PrismaClient, "user">,
  rawCode: string | null | undefined
): Promise<{ id: string } | null> {
  if (!rawCode || !rawCode.trim()) return null;
  const user = await db.user.findUnique({
    where: { referralCode: rawCode.trim().toUpperCase() },
    select: { id: true },
  });
  return user;
}

/**
 * Ensure `userId` has a referral code, generating one if it doesn't yet
 * (accounts created before this feature existed won't have one). Safe to
 * call repeatedly.
 */
export async function getOrCreateReferralCode(
  db: Pick<PrismaClient, "user">,
  userId: string
): Promise<string> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { referralCode: true },
  });
  if (user.referralCode) return user.referralCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const updated = await db.user.update({
        where: { id: userId },
        data: { referralCode: randomReferralCode() },
        select: { referralCode: true },
      });
      return updated.referralCode!;
    } catch (err) {
      const isUniqueClash =
        err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002";
      if (!isUniqueClash || attempt === 4) throw err;
    }
  }
  throw new Error("Failed to provision a referral code after retries");
}

/**
 * Called after a ticket is successfully created. If the ticket's owner was
 * referred by someone and this is that owner's first ticket, grant the
 * referrer their reward card. No-op otherwise. Runs inside the same
 * transaction as ticket creation so the reward and the booking are atomic.
 */
export async function maybeGrantReferralReward(
  tx: Prisma.TransactionClient,
  newTicketOwnerId: string
): Promise<void> {
  const owner = await tx.user.findUnique({
    where: { id: newTicketOwnerId },
    select: { id: true, referredByUserId: true, referralRewardGranted: true },
  });
  if (!owner || !owner.referredByUserId || owner.referralRewardGranted) return;

  const ticketCount = await tx.ticket.count({ where: { userId: owner.id } });
  // This check runs after the new ticket was already created, so "first
  // ticket" means the count is exactly 1 at this point.
  if (ticketCount !== 1) return;

  await issueDiscountCard(tx, {
    userId: owner.referredByUserId,
    percent: REFERRAL_REWARD_PERCENT,
    source: "REFERRAL_REWARD",
  });
  await tx.user.update({
    where: { id: owner.id },
    data: { referralRewardGranted: true },
  });
}
