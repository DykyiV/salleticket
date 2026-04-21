import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@prisma/client";
import { verifySession } from "@/lib/auth/jwt";
import {
  SESSION_COOKIE,
  hasRoleAtLeast,
} from "@/lib/auth/constants";

/**
 * Edge middleware for role-based access control.
 *
 * We configure the matcher to only run on protected prefixes so public pages
 * stay free of any auth overhead.
 */

type Rule = {
  match: (pathname: string) => boolean;
  role: Role;
  /** "json" → respond with 401/403 JSON; "page" → redirect to /login or /. */
  mode: "json" | "page";
};

const RULES: Rule[] = [
  { match: (p) => p.startsWith("/api/admin"), role: "ADMIN", mode: "json" },
  { match: (p) => p.startsWith("/api/agent"), role: "AGENT", mode: "json" },
  { match: (p) => p.startsWith("/admin"), role: "ADMIN", mode: "page" },
  { match: (p) => p.startsWith("/agent"), role: "AGENT", mode: "page" },
  { match: (p) => p.startsWith("/account"), role: "USER", mode: "page" },
  { match: (p) => p.startsWith("/booking"), role: "USER", mode: "page" },
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
    const home = new URL("/", req.url);
    home.searchParams.set("error", "forbidden");
    return NextResponse.redirect(home);
  }

  // Forward identity to downstream handlers/pages as request headers so
  // server components / route handlers can read them without re-verifying.
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
    "/admin/:path*",
    "/agent/:path*",
    "/account/:path*",
    "/booking/:path*",
  ],
};
