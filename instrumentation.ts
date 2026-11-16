import * as Sentry from "@sentry/nextjs";

/**
 * Runs once when the server starts. In production it refuses to start with
 * weak or example secrets (see lib/security/secrets.ts).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  await import("./sentry.server.config");
  const { assertProductionSecrets, isProductionRuntime } = await import("./lib/security/secrets");
  if (isProductionRuntime()) assertProductionSecrets();
}

/** Reports errors from Server Components, route handlers and the proxy to Sentry. */
export const onRequestError = Sentry.captureRequestError;
