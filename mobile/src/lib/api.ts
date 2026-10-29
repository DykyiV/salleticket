import Constants from "expo-constants";

/** The new ticket site this app talks to. */
export const API_URL = String(
  process.env.EXPO_PUBLIC_API_URL ?? Constants.expoConfig?.extra?.apiUrl ?? "http://localhost:3000"
).replace(/\/$/, "");

export class ApiError extends Error {
  /** HTTP status; 0 when the server could not be reached. */
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
  get offline(): boolean {
    return this.status === 0;
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setApiToken(value: string | null): void {
  token = value;
}

/** Called once when the server rejects the saved token (revoked or expired). */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

type Options = { method?: "GET" | "POST"; body?: unknown; lang?: string; auth?: boolean };

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.lang) headers["Accept-Language"] = options.lang;
  const withToken = options.auth !== false && Boolean(token);
  if (withToken) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, "network");
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (res.status === 401 && withToken) onUnauthorized?.();
  if (!res.ok) {
    const message = (data as { error?: unknown } | null)?.error;
    throw new ApiError(res.status, typeof message === "string" ? message : `HTTP ${res.status}`);
  }
  return data as T;
}
