import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

export type RateLimitRule = { limit: number; windowMs: number };

export const LOGIN_PER_ACCOUNT: RateLimitRule = { limit: 5, windowMs: 15 * 60_000 };
export const LOGIN_PER_IP: RateLimitRule = { limit: 20, windowMs: 15 * 60_000 };
export const REGISTER_PER_IP: RateLimitRule = { limit: 10, windowMs: 60 * 60_000 };
/** Guest checkouts (new accounts + «is this e-mail known?» answers) per IP. */
export const GUEST_PER_IP: RateLimitRule = { limit: 20, windowMs: 60 * 60_000 };
/** «Send the ticket by e-mail» presses: per order and per account. */
export const TICKET_MAIL_PER_ORDER: RateLimitRule = { limit: 3, windowMs: 60 * 60_000 };
export const TICKET_MAIL_PER_USER: RateLimitRule = { limit: 10, windowMs: 60 * 60_000 };
/** «Попросити змінити дату» requests per ticket. */
export const CHANGE_REQUEST_PER_TICKET: RateLimitRule = { limit: 3, windowMs: 60 * 60_000 };
/** «Забули пароль?» e-mails: per address and per IP. */
export const RESET_PER_EMAIL: RateLimitRule = { limit: 3, windowMs: 60 * 60_000 };
export const RESET_PER_IP: RateLimitRule = { limit: 10, windowMs: 60 * 60_000 };

/**
 * Client address as reported by the reverse proxy, or null when the request
 * carries none. Per-IP limits are skipped then — otherwise every visitor
 * would share one "unknown" bucket and block each other.
 */
/**
 * The visitor's IP as our own proxy saw it. nginx sets X-Real-IP to the
 * connecting address (a value a visitor sends is overwritten) and appends
 * that address to X-Forwarded-For, so without X-Real-IP only the last entry
 * is trustworthy: anything before it is whatever the visitor typed.
 */
export function clientIp(req: { headers: Headers }): string | null {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const hops = (req.headers.get("x-forwarded-for") ?? "").split(",").map((h) => h.trim()).filter(Boolean);
  return hops.at(-1) ?? null;
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
