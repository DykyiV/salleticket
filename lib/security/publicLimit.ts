import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { blockedFor, clientIp, limitKey, recordHit, retryMessage, type RateLimitRule } from "@/lib/security/rateLimit";

const TEN_MIN = 10 * 60_000;
/** Searches and trip lists (each one asks Grandes Tour). */
export const SEARCH_PER_IP: RateLimitRule = { limit: 120, windowMs: TEN_MIN };
/** Price calendar and seat maps (opened often while choosing). */
export const SEATS_PER_IP: RateLimitRule = { limit: 240, windowMs: TEN_MIN };
/** Fare quotes at checkout. */
export const QUOTE_PER_IP: RateLimitRule = { limit: 120, windowMs: TEN_MIN };
/** Promo-code checks (so codes cannot be guessed by trying many). */
export const PROMO_PER_IP: RateLimitRule = { limit: 30, windowMs: TEN_MIN };
/** Bookings (each one reserves real seats with the carrier). */
export const BOOKING_PER_IP: RateLimitRule = { limit: 20, windowMs: 60 * 60_000 };

/**
 * Per-IP limit of a public endpoint; every call counts. Returns the 429
 * answer when the IP is over the limit, else null. Signed-in staff (any role
 * but CUSTOMER) are not limited: an office or cash desk shares one IP.
 */
export async function limitPublic(req: NextRequest, scope: string, rule: RateLimitRule): Promise<NextResponse | null> {
  const ip = clientIp(req);
  if (!ip) return null;
  const session = await getSessionFromRequest(req);
  if (session && session.role !== "CUSTOMER") return null;
  const key = limitKey(`${scope}:ip`, ip);
  const wait = await blockedFor(key, rule);
  if (wait > 0) {
    return NextResponse.json(
      { error: retryMessage(wait, "запитів") },
      { status: 429, headers: { "Retry-After": String(wait) } },
    );
  }
  await recordHit(key, rule);
  return null;
}
