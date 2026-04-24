import { NextResponse } from "next/server";

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // Protect account pages and private APIs; allow public pages freely.
  const needsAuth =
    pathname.startsWith("/account") ||
    pathname.startsWith("/agent") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/reports") ||
    pathname.startsWith("/api/agent") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/private");

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

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (payload.role !== "ADMIN" && payload.role !== "SUPER_ADMIN") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  if (pathname.startsWith("/api/reports")) {
    if (payload.role !== "ADMIN" && payload.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (pathname.startsWith("/agent") || pathname.startsWith("/api/agent")) {
    if (payload.role !== "AGENT" && payload.role !== "ADMIN" && payload.role !== "SUPER_ADMIN") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/account/:path*",
    "/agent/:path*",
    "/admin/:path*",
    "/api/reports/:path*",
    "/api/agent/:path*",
    "/api/admin/:path*",
    "/api/private/:path*",
  ],
};
