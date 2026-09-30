import { NextResponse, type NextRequest } from "next/server";
import { finishOAuth, isOAuthProvider, publicOrigin } from "@/lib/auth/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(req: NextRequest, provider: string) {
  const url = new URL("/login", publicOrigin(req));
  url.searchParams.set("error", "oauth_failed");
  url.searchParams.set("provider", provider);
  return NextResponse.redirect(url);
}

function appleName(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      name?: { firstName?: string; lastName?: string };
    };
    const name = [parsed.name?.firstName, parsed.name?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    return name || null;
  } catch {
    return null;
  }
}

async function complete(
  req: NextRequest,
  provider: string,
  code: string | null,
  state: string | null,
  name?: string | null
) {
  if (!isOAuthProvider(provider) || !code || !state) return fail(req, provider);
  return finishOAuth(req, provider, code, state, name);
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> }
) {
  const { provider } = await ctx.params;
  return complete(
    req,
    provider,
    req.nextUrl.searchParams.get("code"),
    req.nextUrl.searchParams.get("state")
  );
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> }
) {
  const { provider } = await ctx.params;
  const form = await req.formData();
  return complete(
    req,
    provider,
    String(form.get("code") ?? "") || null,
    String(form.get("state") ?? "") || null,
    appleName(form.get("user"))
  );
}
