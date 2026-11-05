/**
 * Minimal HTTP client for the Grandes Tour booking API
 * (https://grandes-tour.com.ua/swagger/v3/swagger.json).
 * Auth: `Api-Key` header from GRANDES_TOUR_API_KEY. Booking calls
 * (reserve, cancel, discount cards) also need a signed-in GT account:
 * GRANDES_TOUR_EMAIL / GRANDES_TOUR_PASSWORD (the Kaufmann agent account),
 * sent as `Authorization: Bearer <access_token>`.
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

let accessToken: string | null = null;

/** Signs the Kaufmann agent account in; null when no account is configured. */
async function signIn(): Promise<string | null> {
  const email = process.env.GRANDES_TOUR_EMAIL?.trim();
  const password = process.env.GRANDES_TOUR_PASSWORD;
  if (!email || !password) return null;
  const res = await request<{ sign_in_status?: string; access_token?: string | null }>("/api/v2/auth/signin", {
    method: "POST",
    json: { email, password, response_type: "token" },
  });
  if (res.status !== 200 || !res.body?.access_token) {
    throw new Error(`Grandes Tour: вхід акаунта ${email} не вдався (${res.body?.sign_in_status ?? res.body?.error ?? `HTTP ${res.status}`})`);
  }
  accessToken = res.body.access_token;
  return accessToken;
}

async function request<T>(
  path: string,
  { method = "GET", query, json }: CallOptions,
  token?: string | null,
): Promise<{ status: number; body: (T & { success?: boolean; error?: string }) | null }> {
  const key = process.env.GRANDES_TOUR_API_KEY?.trim();
  if (!key) throw new Error("GRANDES_TOUR_API_KEY is not set");
  const url = new URL(path, process.env.GRANDES_TOUR_API_URL || DEFAULT_BASE);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method,
    headers: {
      "Api-Key": key,
      "Accept-Language": "uk",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: json !== undefined ? JSON.stringify(json) : undefined,
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as (T & { success?: boolean; error?: string }) | null;
  return { status: res.status, body };
}

export async function gtCall<T>(path: string, options: CallOptions = {}): Promise<T> {
  let res = await request<T>(path, options, accessToken);
  if (res.status === 401) {
    // Booking endpoints need the agent account; (re)sign in once and retry.
    const token = await signIn();
    if (!token) {
      throw new Error(
        `Grandes Tour ${path}: потрібен вхід акаунта агента (GRANDES_TOUR_EMAIL / GRANDES_TOUR_PASSWORD у gt.env)`,
      );
    }
    res = await request<T>(path, options, token);
  }
  const { status, body } = res;
  if (status < 200 || status >= 300 || !body || body.success === false) {
    throw new Error(`Grandes Tour ${path}: ${body?.error || `HTTP ${status}`}`);
  }
  return body;
}
