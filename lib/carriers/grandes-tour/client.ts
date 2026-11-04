/**
 * Minimal HTTP client for the Grandes Tour booking API
 * (https://grandes-tour.com.ua/swagger/v3/swagger.json).
 * Auth: `Api-Key` header from GRANDES_TOUR_API_KEY.
 */
const DEFAULT_BASE = "https://grandes-tour.com.ua";

export function grandesTourEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.GRANDES_TOUR_API_KEY?.trim());
}

type CallOptions = {
  method?: "GET" | "POST";
  query?: Record<string, string | number>;
  json?: unknown;
};

export async function gtCall<T>(path: string, { method = "GET", query, json }: CallOptions = {}): Promise<T> {
  const key = process.env.GRANDES_TOUR_API_KEY?.trim();
  if (!key) throw new Error("GRANDES_TOUR_API_KEY is not set");
  const url = new URL(path, process.env.GRANDES_TOUR_API_URL || DEFAULT_BASE);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method,
    headers: {
      "Api-Key": key,
      "Accept-Language": "uk",
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: json !== undefined ? JSON.stringify(json) : undefined,
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as (T & { success?: boolean; error?: string }) | null;
  if (!res.ok || !body || body.success === false) {
    throw new Error(`Grandes Tour ${path}: ${body?.error || `HTTP ${res.status}`}`);
  }
  return body;
}
