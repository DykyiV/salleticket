import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@prisma/client";
import { verifySession } from "@/lib/auth/jwt";
import {
  SESSION_COOKIE,
  hasRoleAtLeast,
} from "@/lib/auth/constants";

type Rule = {
  match: (pathname: string) => boolean;
  role: Role;
  mode: "json" | "page";
};

const RULES: Rule[] = [
  { match: (p) => p.startsWith("/api/admin"), role: "ADMIN", mode: "json" },
  { match: (p) => p.startsWith("/api/agent"), role: "AGENT", mode: "json" },
  { match: (p) => p.startsWith("/api/account"), role: "CUSTOMER", mode: "json" },
  { match: (p) => p.startsWith("/admin"), role: "ADMIN", mode: "page" },
  { match: (p) => p.startsWith("/agent"), role: "AGENT", mode: "page" },
  {
    match: (p) =>
      p.startsWith("/cabinet/routes") ||
      p.startsWith("/cabinet/settings") ||
      p.startsWith("/cabinet/reports") ||
      p.startsWith("/cabinet/stats"),
    role: "ADMIN",
    mode: "page",
  },
  { match: (p) => p.startsWith("/cabinet/departures"), role: "AGENT", mode: "page" },
  { match: (p) => p.startsWith("/cabinet"), role: "CUSTOMER", mode: "page" },
  { match: (p) => p.startsWith("/account"), role: "CUSTOMER", mode: "page" },
];

function matchRule(pathname: string): Rule | null {
  return RULES.find((r) => r.match(pathname)) ?? null;
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const rule = matchRule(pathname);
  if (!rule) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    if (rule.mode === "json") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  if (!hasRoleAtLeast(session.role, rule.role)) {
    if (rule.mode === "json") {
      return NextResponse.json(
        { error: `Forbidden: ${rule.role} role required` },
        { status: 403 }
      );
    }
    const cabinet = new URL("/cabinet", req.url);
    cabinet.searchParams.set("error", "forbidden");
    return NextResponse.redirect(cabinet);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-user-id", session.sub);
  requestHeaders.set("x-user-email", session.email);
  requestHeaders.set("x-user-role", session.role);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/api/admin/:path*",
    "/api/agent/:path*",
    "/api/account/:path*",
    "/admin",
    "/admin/:path*",
    "/agent",
    "/agent/:path*",
    "/account",
    "/account/:path*",
    "/cabinet",
    "/cabinet/:path*",
  ],
};
