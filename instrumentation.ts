/**
 * Runs once when the server starts. In production it refuses to start with
 * weak or example secrets (see lib/security/secrets.ts).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertProductionSecrets, isProductionRuntime } = await import("./lib/security/secrets");
  if (isProductionRuntime()) assertProductionSecrets();
}
