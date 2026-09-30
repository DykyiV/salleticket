import { NextResponse, type NextRequest } from "next/server";
import { isOAuthProvider, startOAuth } from "@/lib/auth/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> }
) {
  const { provider } = await ctx.params;
  if (!isOAuthProvider(provider)) {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", "oauth_failed");
    return NextResponse.redirect(url);
  }
  return startOAuth(req, provider, req.nextUrl.searchParams.get("next") ?? "");
}
