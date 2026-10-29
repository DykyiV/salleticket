import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { Role } from "@prisma/client";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/auth/constants";
import { isProductionRuntime, productionSecretProblem } from "@/lib/security/secrets";

export type SessionPayload = JWTPayload & {
  sub: string;
  email: string;
  role: Role;
  /** User.sessionVersion at issue time (see lib/auth/resolve.ts). */
  v?: number;
};

const ALG = "HS256";

function getSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  if (!raw || raw.length < 16) {
    throw new Error(
      "JWT_SECRET is missing or too short. Set it in .env to a string of at least 16 chars."
    );
  }
  if (isProductionRuntime()) {
    const problem = productionSecretProblem("JWT_SECRET", raw);
    if (problem) throw new Error(`${problem} — refusing to sign or verify sessions in production`);
  }
  return new TextEncoder().encode(raw);
}

export async function signSession(
  payload: {
    sub: string;
    email: string;
    role: Role;
    v: number;
  },
  ttlSeconds: number = SESSION_MAX_AGE_SECONDS
): Promise<string> {
  return await new SignJWT({ email: payload.email, role: payload.role, v: payload.v })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(getSecret());
}

export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: [ALG],
    });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string" ||
      (payload.v !== undefined && typeof payload.v !== "number")
    ) {
      return null;
    }
    return payload as SessionPayload;
  } catch {
    return null;
  }
}
