/**
 * The mobile app sends its session token as `Authorization: Bearer <jwt>`
 * instead of the site's cookie. It is the same signed session token, checked
 * by resolveSession() against the database (role, sessionVersion), so logout
 * and revocation work for the app exactly as for the site.
 *
 * A browser never attaches this header on its own, so accepting it adds no
 * cross-site request risk.
 */
export function bearerToken(headers: { get(name: string): string | null }): string | null {
  const raw = headers.get("authorization");
  if (!raw) return null;
  const match = /^Bearer\s+([A-Za-z0-9._~+/=-]+)\s*$/i.exec(raw.trim());
  return match ? match[1] : null;
}

/** Cookie first (the site), then the app's bearer token. */
export function sessionTokenFrom(cookie: string | undefined | null, headers: { get(name: string): string | null }): string | null {
  return cookie || bearerToken(headers);
}
