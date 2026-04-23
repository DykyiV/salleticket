import { NextResponse } from "next/server";

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // Protect account pages and private APIs; allow public pages freely.
  const needsAuth =
    pathname.startsWith("/account") || pathname.startsWith("/api/private");

  if (!needsAuth) {
    return NextResponse.next();
  }

  const token = req.cookies.get("asol_session")?.value;
  let payload = null;
  if (token) {
    try {
      const [, payloadPart] = token.split(".");
      if (payloadPart) {
        const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
        const decoded = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
        if (decoded?.exp && Date.now() / 1000 <= decoded.exp) {
          payload = decoded;
        }
      }
    } catch {
      payload = null;
    }
  }

  if (!payload) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/api/private/:path*"],
};
