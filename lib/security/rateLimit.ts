import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export type RateLimitRule = { limit: number; windowMs: number };

export const LOGIN_PER_ACCOUNT: RateLimitRule = { limit: 5, windowMs: 15 * 60_000 };
export const LOGIN_PER_IP: RateLimitRule = { limit: 20, windowMs: 15 * 60_000 };
export const REGISTER_PER_IP: RateLimitRule = { limit: 10, windowMs: 60 * 60_000 };

/**
 * Client address as reported by the reverse proxy, or null when the request
 * carries none. Per-IP limits are skipped then — otherwise every visitor
 * would share one "unknown" bucket and block each other.
 */
export function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0]?.trim() : req.headers.get("x-real-ip");
  return ip || null;
}

/** Keys are hashed so e-mails and IPs are not stored in plain text. */
export function limitKey(scope: string, value: string): string {
  return `${scope}:${createHash("sha256").update(value.toLowerCase()).digest("hex").slice(0, 32)}`;
}

/** Seconds until the window resets, or 0 when the key is under the limit. */
export async function blockedFor(key: string, rule: RateLimitRule): Promise<number> {
  const row = await prisma.rateLimit.findUnique({ where: { key } });
  const now = Date.now();
  if (!row || row.resetAt.getTime() <= now || row.count < rule.limit) return 0;
  return Math.max(1, Math.ceil((row.resetAt.getTime() - now) / 1000));
}

/** Count one event against the key. */
export async function recordHit(key: string, rule: RateLimitRule): Promise<void> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + rule.windowMs);
  await prisma.$transaction(async (tx) => {
    const row = await tx.rateLimit.findUnique({ where: { key } });
    if (!row || row.resetAt <= now) {
      await tx.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, resetAt },
        update: { count: 1, resetAt },
      });
    } else {
      await tx.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
    }
  });
  if (Math.random() < 0.02) {
    await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: now } } }).catch(() => {});
  }
}

export async function clearHits(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } });
}

export function retryMessage(seconds: number, what = "спроб"): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Забагато ${what}. Спробуйте ще раз через ${minutes} хв.`;
}
