/**
 * Production must never run with the example secrets from .env.example (or
 * any other well-known value): anyone could then sign their own session
 * token or call the cron endpoints. Checked once at server start
 * (instrumentation.ts) and again whenever a secret is used.
 */

/** Values that are public (docs, examples, old defaults) — never valid. */
export const KNOWN_PUBLIC_SECRETS = new Set([
  "super-secret-key-12345",
  "change-me-cron-secret",
  "changeme",
  "secret",
  "openssl rand -base64 48",
]);

export const MIN_PRODUCTION_SECRET_LENGTH = 32;

/** True when serving in production (not while `next build` runs). */
export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build";
}

/** Why a secret is not acceptable in production, or null when it is fine. */
export function productionSecretProblem(name: string, value: string | undefined): string | null {
  if (!value) return `${name} is not set`;
  if (KNOWN_PUBLIC_SECRETS.has(value.trim())) return `${name} uses the public example value`;
  if (value.length < MIN_PRODUCTION_SECRET_LENGTH) {
    return `${name} is shorter than ${MIN_PRODUCTION_SECRET_LENGTH} characters`;
  }
  return null;
}

/**
 * Throws with every problem found. JWT_SECRET is required; CRON_SECRET is
 * optional (the cron endpoints answer 503 without it) but must be strong
 * when present.
 */
export function assertProductionSecrets(env: NodeJS.ProcessEnv = process.env): void {
  const problems = [
    productionSecretProblem("JWT_SECRET", env.JWT_SECRET),
    env.CRON_SECRET ? productionSecretProblem("CRON_SECRET", env.CRON_SECRET) : null,
  ].filter((p): p is string => Boolean(p));
  if (problems.length) {
    throw new Error(
      `Refusing to start in production: ${problems.join("; ")}. ` +
        "Generate strong values with: openssl rand -base64 48"
    );
  }
}
