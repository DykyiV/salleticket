/**
 * Where to send a visitor after signing in. The `?next=` value comes from
 * the address bar, so anyone can put any link there: only a path on this
 * site is accepted, everything else (another domain, `//host`, `/\host`,
 * `javascript:`, control characters, the sign-in pages themselves, API
 * routes) is dropped and the caller's fallback is used instead.
 */
const BASE = "http://same-origin.invalid";
const BLOCKED = /^\/(login|register|api)(\/|$|\?|#)/i;

export function safeNextPath(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > 512) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  // Browsers treat "\" like "/" in URLs, so "/\evil.com" means "//evil.com".
  if (value.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;
  const path = `${url.pathname}${url.search}${url.hash}`;
  if (BLOCKED.test(path)) return null;
  return path;
}

/** Default landing page after sign-in: passengers → «Мої квитки», staff → cabinet. */
export function homeAfterSignIn(role: string | null | undefined): string {
  return !role || role === "CUSTOMER" ? "/tickets" : "/cabinet";
}
