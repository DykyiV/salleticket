import { randomBytes } from "crypto";
import { SignJWT, importPKCS8 } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { issueSession, setSessionCookie } from "@/lib/auth/session";
import { claimGuestTickets, clearGuestCookie, readGuestToken } from "@/lib/auth/guest";

export const OAUTH_PROVIDERS = ["google", "apple", "facebook", "instagram"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

const STATE_COOKIE = "asol_oauth_state";

export function isOAuthProvider(value: string): value is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

export function providerLabel(provider: OAuthProvider): string {
  switch (provider) {
    case "google":
      return "Google";
    case "apple":
      return "Apple";
    case "facebook":
      return "Facebook";
    case "instagram":
      return "Instagram";
  }
}

type ProviderEnv = { clientId: string; clientSecret: string };

function envPair(idKey: string, secretKey: string): ProviderEnv | null {
  const clientId = process.env[idKey]?.trim();
  const clientSecret = process.env[secretKey]?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function providerCredentials(provider: OAuthProvider): ProviderEnv | null {
  switch (provider) {
    case "google":
      return envPair("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET");
    case "apple":
      return envPair("APPLE_CLIENT_ID", "APPLE_PRIVATE_KEY");
    case "facebook":
      return envPair("FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET");
    case "instagram":
      return envPair("INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET");
  }
}

export function publicOrigin(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export function callbackUrl(req: NextRequest, provider: OAuthProvider): string {
  return `${publicOrigin(req)}/api/auth/oauth/${provider}/callback`;
}

export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/cabinet/tickets";
  return value;
}

export function beginOAuth(res: NextResponse, provider: OAuthProvider, nextPath: string): string {
  const state = randomBytes(24).toString("hex");
  res.cookies.set({
    name: STATE_COOKIE,
    value: JSON.stringify({ state, provider, next: safeNextPath(nextPath) }),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  return state;
}

function readState(req: NextRequest): { state: string; provider: OAuthProvider; next: string } | null {
  const raw = req.cookies.get(STATE_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: string; provider?: string; next?: string };
    if (!parsed.state || !parsed.provider || !isOAuthProvider(parsed.provider)) return null;
    return { state: parsed.state, provider: parsed.provider, next: safeNextPath(parsed.next) };
  } catch {
    return null;
  }
}

export function authorizeUrl(provider: OAuthProvider, req: NextRequest, state: string): string | null {
  const creds = providerCredentials(provider);
  if (!creds) return null;
  const redirect = callbackUrl(req, provider);
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: redirect,
    state,
    response_type: "code",
  });
  switch (provider) {
    case "google":
      params.set("scope", "openid email profile");
      params.set("prompt", "select_account");
      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    case "apple":
      params.set("scope", "name email");
      params.set("response_mode", "form_post");
      return `https://appleid.apple.com/auth/authorize?${params}`;
    case "facebook":
      params.set("scope", "email,public_profile");
      return `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
    case "instagram":
      params.set("scope", "instagram_business_basic");
      return `https://www.instagram.com/oauth/authorize?${params}`;
  }
}

type Profile = {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

async function appleClientSecret(clientId: string): Promise<string> {
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  const keyId = process.env.APPLE_KEY_ID?.trim();
  const privateKey = process.env.APPLE_PRIVATE_KEY?.trim();
  if (!teamId || !keyId || !privateKey) {
    throw new Error("Apple sign-in is missing APPLE_TEAM_ID or APPLE_KEY_ID");
  }
  const key = await importPKCS8(privateKey.replace(/\\n/g, "\n"), "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}

async function exchangeCode(provider: OAuthProvider, req: NextRequest, code: string): Promise<Profile> {
  const creds = providerCredentials(provider);
  if (!creds) throw new Error("Provider is not configured");
  const redirect = callbackUrl(req, provider);

  if (provider === "google") {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        redirect_uri: redirect,
        grant_type: "authorization_code",
      }),
    });
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!token.access_token) throw new Error("Google did not return a token");
    const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const profile = (await profileRes.json()) as {
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
    };
    if (!profile.sub || !profile.email) throw new Error("Google account has no email");
    return {
      provider,
      providerAccountId: profile.sub,
      email: profile.email.toLowerCase(),
      name: profile.name ?? null,
      avatarUrl: profile.picture ?? null,
    };
  }

  if (provider === "apple") {
    const clientSecret = await appleClientSecret(creds.clientId);
    const tokenRes = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: creds.clientId,
        client_secret: clientSecret,
        redirect_uri: redirect,
        grant_type: "authorization_code",
      }),
    });
    const token = (await tokenRes.json()) as { id_token?: string };
    if (!token.id_token) throw new Error("Apple did not return an id token");
    const payload = JSON.parse(Buffer.from(token.id_token.split(".")[1] ?? "", "base64url").toString("utf8")) as {
      sub?: string;
      email?: string;
    };
    if (!payload.sub) throw new Error("Apple account has no id");
    const email = payload.email?.toLowerCase() ?? `apple_${payload.sub}@oauth.asolbus.local`;
    return { provider, providerAccountId: payload.sub, email, name: null, avatarUrl: null };
  }

  if (provider === "facebook") {
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({
        code,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        redirect_uri: redirect,
      })}`
    );
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!token.access_token) throw new Error("Facebook did not return a token");
    const profileRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${encodeURIComponent(token.access_token)}`
    );
    const profile = (await profileRes.json()) as {
      id?: string;
      name?: string;
      email?: string;
      picture?: { data?: { url?: string } };
    };
    if (!profile.id) throw new Error("Facebook account has no id");
    return {
      provider,
      providerAccountId: profile.id,
      email: profile.email?.toLowerCase() ?? `facebook_${profile.id}@oauth.asolbus.local`,
      name: profile.name ?? null,
      avatarUrl: profile.picture?.data?.url ?? null,
    };
  }

  const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: redirect,
      grant_type: "authorization_code",
    }),
  });
  const token = (await tokenRes.json()) as { access_token?: string; user_id?: string | number };
  if (!token.access_token) throw new Error("Instagram did not return a token");
  const profileRes = await fetch(
    `https://graph.instagram.com/me?fields=user_id,username&access_token=${encodeURIComponent(token.access_token)}`
  );
  const profile = (await profileRes.json()) as { user_id?: string; username?: string; id?: string };
  const id = String(profile.user_id ?? profile.id ?? token.user_id ?? "");
  if (!id) throw new Error("Instagram account has no id");
  const username = profile.username ?? id;
  return {
    provider,
    providerAccountId: id,
    email: `instagram_${id}@oauth.asolbus.local`,
    name: username,
    avatarUrl: null,
  };
}

async function upsertOAuthUser(profile: Profile) {
  const linked = await prisma.user.findFirst({
    where: { authProvider: profile.provider, providerAccountId: profile.providerAccountId },
  });
  if (linked) {
    return prisma.user.update({
      where: { id: linked.id },
      data: {
        displayName: linked.displayName ?? profile.name,
        avatarUrl: linked.avatarUrl ?? profile.avatarUrl,
      },
    });
  }
  const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
  if (byEmail) {
    return prisma.user.update({
      where: { id: byEmail.id },
      data: {
        authProvider: byEmail.authProvider === "password" ? profile.provider : byEmail.authProvider,
        providerAccountId: byEmail.providerAccountId ?? profile.providerAccountId,
        displayName: byEmail.displayName ?? profile.name,
        avatarUrl: byEmail.avatarUrl ?? profile.avatarUrl,
      },
    });
  }
  return prisma.user.create({
    data: {
      email: profile.email,
      password: null,
      role: "CUSTOMER",
      authProvider: profile.provider,
      providerAccountId: profile.providerAccountId,
      displayName: profile.name,
      avatarUrl: profile.avatarUrl,
    },
  });
}

export function startOAuth(req: NextRequest, provider: OAuthProvider, nextPath: string): NextResponse {
  const next = safeNextPath(nextPath);
  const scratch = new NextResponse(null, { status: 204 });
  const state = beginOAuth(scratch, provider, next);
  const url = authorizeUrl(provider, req, state);
  if (!url) {
    const fail = new URL("/login", publicOrigin(req));
    fail.searchParams.set("error", "oauth_unconfigured");
    fail.searchParams.set("provider", provider);
    fail.searchParams.set("next", next);
    return NextResponse.redirect(fail);
  }
  const res = NextResponse.redirect(url);
  const value = scratch.cookies.get(STATE_COOKIE)?.value;
  if (value) {
    res.cookies.set({
      name: STATE_COOKIE,
      value,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });
  }
  return res;
}

export async function finishOAuth(
  req: NextRequest,
  provider: OAuthProvider,
  code: string,
  state: string,
  displayName?: string | null
): Promise<NextResponse> {
  const saved = readState(req);
  const fail = (reason: string) => {
    const url = new URL("/login", publicOrigin(req));
    url.searchParams.set("error", reason);
    url.searchParams.set("provider", provider);
    const res = NextResponse.redirect(url);
    res.cookies.set({ name: STATE_COOKIE, value: "", path: "/", maxAge: 0 });
    return res;
  };
  if (!saved || saved.state !== state || saved.provider !== provider) return fail("oauth_state");

  let profile: Profile;
  try {
    profile = await exchangeCode(provider, req, code);
  } catch {
    return fail("oauth_failed");
  }
  if (!profile.name && displayName) profile.name = displayName;
  const user = await upsertOAuthUser(profile);
  const claimed = await claimGuestTickets(user.id, readGuestToken(req));
  const token = await issueSession(user);
  const destPath = saved.next.startsWith("/pay/")
    ? saved.next
    : claimed > 0
      ? "/cabinet/tickets"
      : saved.next;
  const dest = new URL(destPath, publicOrigin(req));
  const res = NextResponse.redirect(dest);
  setSessionCookie(res, token);
  clearGuestCookie(res);
  res.cookies.set({ name: STATE_COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}
