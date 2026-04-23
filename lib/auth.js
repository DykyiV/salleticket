import crypto from "crypto";

const COOKIE_NAME = "asol_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}

function decodeB64urlJson(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

function secret() {
  return process.env.JWT_SECRET || "dev-secret-change-me";
}

function sign(input) {
  return b64url(crypto.createHmac("sha256", secret()).update(input).digest());
}

export function issueJwt(payload) {
  const now = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    iat: now,
    exp: now + COOKIE_MAX_AGE,
  };
  const header = b64urlJson({ alg: "HS256", typ: "JWT" });
  const data = `${header}.${b64urlJson(body)}`;
  const signature = sign(data);
  return `${data}.${signature}`;
}

export function verifyJwt(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const data = `${header}.${payload}`;
  if (sign(data) !== signature) return null;
  try {
    const parsed = decodeB64urlJson(payload);
    if (!parsed.exp || Date.now() / 1000 > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader = "") {
  return cookieHeader
    .split(";")
    .map((v) => v.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const idx = pair.indexOf("=");
      if (idx === -1) return acc;
      const key = pair.slice(0, idx);
      const value = decodeURIComponent(pair.slice(idx + 1));
      acc[key] = value;
      return acc;
    }, {});
}

export function getSessionFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies[COOKIE_NAME];
  return verifyJwt(token);
}

export function sessionCookie(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
