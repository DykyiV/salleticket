import * as Sentry from "@sentry/nextjs";

const DAY_MS = 24 * 60 * 60_000;
const lastSent = new Map<string, number>();

/**
 * Tells the owner about a problem: a Sentry issue, and Sentry e-mails every
 * new issue. `key` groups repeats into one issue (so one e-mail); the same
 * key is sent at most once a day.
 */
export function alertOwner(key: string[], message: string, extra: Record<string, unknown> = {}, now = Date.now()): void {
  const id = key.join("|");
  if (now - (lastSent.get(id) ?? -DAY_MS) < DAY_MS) return;
  lastSent.set(id, now);
  Sentry.withScope((scope) => {
    scope.setFingerprint(key);
    scope.setLevel("error");
    scope.setExtras(extra);
    Sentry.captureMessage(message);
  });
}
