import * as Sentry from "@sentry/nextjs";
import { alertOwner } from "@/lib/alerts";
import { gtCall, grandesTourEnabled } from "@/lib/carriers/grandes-tour/client";
import { prisma } from "@/lib/db";

/**
 * Health of the site for /api/health, which the server's cron asks every
 * 5 minutes. Two alarms come out of it, both through Sentry (→ e-mail):
 *  - the site: every good answer is a check-in of the Sentry cron monitor
 *    «kaufmann-site». When the site, its database, nginx or the whole server
 *    is down, check-ins stop and Sentry reports the monitor as failed;
 *  - Grandes Tour: two failed probes in a row raise an issue (one a day).
 */
export type Health = { db: boolean; gt: boolean | null };

const SITE_MONITOR = {
  schedule: { type: "crontab", value: "*/5 * * * *" },
  // One missed probe (a deploy restarts the site for some seconds) is not an outage.
  checkinMargin: 7,
  failureIssueThreshold: 1,
  recoveryThreshold: 1,
} as const;

const CACHE_MS = 60_000;
let cached: { at: number; health: Health } | null = null;
let gtFailures = 0;

export async function checkHealth(now = Date.now()): Promise<Health> {
  if (cached && now - cached.at < CACHE_MS) return cached.health;

  const db = await prisma.$queryRaw`SELECT 1`.then(
    () => true,
    () => false,
  );

  let gt: boolean | null = null;
  if (grandesTourEnabled()) {
    const error: Error | null = await gtCall("/api/v3/cache/cities").then(
      () => null,
      (e) => e,
    );
    gt = !error;
    gtFailures = error ? gtFailures + 1 : 0;
    if (error && gtFailures >= 2) {
      alertOwner(
        ["gt-down", new Date(now).toISOString().slice(0, 10)],
        "Grandes Tour не відповідає: пошук і бронювання на сайті не працюють",
        { error: error.message },
        now,
      );
    }
  }

  if (db) Sentry.captureCheckIn({ monitorSlug: "kaufmann-site", status: "ok" }, SITE_MONITOR);
  cached = { at: now, health: { db, gt } };
  return cached.health;
}
