import { Prisma, PromoType, type PrismaClient } from "@prisma/client";

export type DiscountPayload = {
  code?: unknown;
  /** "PERCENT" | "FIXED". Optional on PATCH; defaults to "PERCENT" on create. */
  type?: unknown;
  /**
   * One number interpreted by `type`.
   *   PERCENT: 0..1 fraction or 1..99 whole percent (auto-scaled).
   *   FIXED:   EUR amount, > 0.
   * If absent, the legacy `percent` / `amount` fields are accepted.
   */
  value?: unknown;
  percent?: unknown;
  amount?: unknown;
  label?: unknown;
  isActive?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  usageLimit?: unknown;
  /** Convenience for admins: bind by email. Takes precedence over userId. */
  userEmail?: unknown;
  userId?: unknown;
};

export class DiscountValidationError extends Error {}

/** Parse "YYYY-MM-DD" or ISO into a Date (or null). Throws on garbage. */
function parseDate(input: unknown, field: string): Date | null | undefined {
  if (input === undefined) return undefined; // leave untouched on PATCH
  if (input === null || input === "") return null;
  if (typeof input !== "string") {
    throw new DiscountValidationError(`${field} must be an ISO date string`);
  }
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    throw new DiscountValidationError(`${field} must be an ISO date string`);
  }
  return d;
}

function parseInt0Plus(input: unknown, field: string): number | null | undefined {
  if (input === undefined) return undefined;
  if (input === null || input === "") return null;
  const n =
    typeof input === "number" ? input : Number.parseInt(String(input), 10);
  if (!Number.isFinite(n) || n < 0) {
    throw new DiscountValidationError(`${field} must be a non-negative integer`);
  }
  return Math.floor(n);
}

function parsePercent(input: unknown): number | undefined {
  if (input === undefined) return undefined;
  let n: number;
  if (typeof input === "number") {
    n = input;
  } else {
    n = Number.parseFloat(String(input));
  }
  if (!Number.isFinite(n)) {
    throw new DiscountValidationError("percent must be a number between 0 and 1");
  }
  // Accept both "0.1" and "10" (interpret >=1 as whole percents)
  if (n >= 1) n = n / 100;
  if (n <= 0 || n >= 1) {
    throw new DiscountValidationError(
      "percent must be > 0 and < 1 (e.g. 0.1 for 10%)"
    );
  }
  return Math.round(n * 10000) / 10000;
}

function parseAmount(input: unknown): number | undefined {
  if (input === undefined) return undefined;
  const n =
    typeof input === "number" ? input : Number.parseFloat(String(input));
  if (!Number.isFinite(n) || n <= 0) {
    throw new DiscountValidationError(
      "amount must be a positive number (e.g. 5 for €5)"
    );
  }
  return Math.round(n * 100) / 100;
}

function parseType(input: unknown): PromoType | undefined {
  if (input === undefined) return undefined;
  const raw = String(input).trim().toUpperCase();
  if (raw === "PERCENT" || raw === "FIXED") return raw as PromoType;
  throw new DiscountValidationError("type must be PERCENT or FIXED");
}

/**
 * Resolve (type, percent, amount) from either the new (type, value) fields
 * or the legacy (percent, amount). Returns undefined for "not supplied" to
 * preserve PATCH semantics.
 */
function parseTypeAndValue(
  payload: DiscountPayload,
  fallbackType: PromoType | undefined
): {
  type?: PromoType;
  percent?: number | null;
  amount?: number | null;
} {
  const explicitType = parseType(payload.type);
  const legacyPercent = parsePercent(payload.percent);
  const legacyAmount = parseAmount(payload.amount);

  // If only legacy fields were sent, keep previous behavior.
  if (payload.value === undefined) {
    const out: { type?: PromoType; percent?: number | null; amount?: number | null } = {};
    if (explicitType !== undefined) out.type = explicitType;
    if (legacyPercent !== undefined) {
      out.percent = legacyPercent;
      // Switching to PERCENT clears amount to keep the row coherent.
      if ((explicitType ?? fallbackType) === "PERCENT") {
        out.amount = null;
      }
    }
    if (legacyAmount !== undefined) {
      out.amount = legacyAmount;
      if ((explicitType ?? fallbackType) === "FIXED") {
        out.percent = 0;
      }
    }
    return out;
  }

  // New shape: a single `value` interpreted by `type`.
  const effectiveType = explicitType ?? fallbackType ?? PromoType.PERCENT;
  if (effectiveType === PromoType.PERCENT) {
    const percent = parsePercent(payload.value);
    if (percent === undefined) {
      throw new DiscountValidationError("value is required");
    }
    return { type: PromoType.PERCENT, percent, amount: null };
  }
  const amount = parseAmount(payload.value);
  if (amount === undefined) {
    throw new DiscountValidationError("value is required");
  }
  return { type: PromoType.FIXED, percent: 0, amount };
}

function parseCode(input: unknown): string | undefined {
  if (input === undefined) return undefined;
  if (typeof input !== "string" || !input.trim()) {
    throw new DiscountValidationError("code must be a non-empty string");
  }
  const code = input.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,32}$/.test(code)) {
    throw new DiscountValidationError(
      "code must be 2–32 chars: A–Z, 0–9, _ or -"
    );
  }
  return code;
}

async function resolveUserId(
  db: Pick<PrismaClient, "user">,
  payload: DiscountPayload
): Promise<{ userId: string | null } | undefined> {
  // `userEmail` wins when present; otherwise fall back to raw `userId`.
  if (payload.userEmail !== undefined) {
    if (payload.userEmail === null || payload.userEmail === "") {
      return { userId: null };
    }
    if (typeof payload.userEmail !== "string") {
      throw new DiscountValidationError("userEmail must be a string or null");
    }
    const user = await db.user.findUnique({
      where: { email: payload.userEmail.trim().toLowerCase() },
      select: { id: true },
    });
    if (!user) {
      throw new DiscountValidationError(
        `No user found with email ${payload.userEmail}`
      );
    }
    return { userId: user.id };
  }
  if (payload.userId !== undefined) {
    if (payload.userId === null || payload.userId === "") {
      return { userId: null };
    }
    if (typeof payload.userId !== "string") {
      throw new DiscountValidationError("userId must be a string or null");
    }
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: { id: true },
    });
    if (!user) {
      throw new DiscountValidationError(
        `No user found with id ${payload.userId}`
      );
    }
    return { userId: user.id };
  }
  return undefined;
}

/** Normalised body for create. Throws DiscountValidationError on bad input. */
export async function parseCreateDiscount(
  db: Pick<PrismaClient, "user">,
  payload: DiscountPayload
): Promise<Prisma.PromoCreateInput> {
  const code = parseCode(payload.code);
  if (!code) throw new DiscountValidationError("code is required");

  const tv = parseTypeAndValue(payload, undefined);
  if (tv.type === undefined && tv.percent === undefined && tv.amount === undefined) {
    throw new DiscountValidationError("value is required");
  }
  const type = tv.type ?? PromoType.PERCENT;
  const percent =
    tv.percent !== undefined && tv.percent !== null ? tv.percent : 0;
  const amount =
    tv.amount !== undefined && tv.amount !== null ? tv.amount : null;
  if (type === PromoType.PERCENT && percent <= 0) {
    throw new DiscountValidationError("value is required");
  }
  if (type === PromoType.FIXED && (amount === null || amount <= 0)) {
    throw new DiscountValidationError("value is required");
  }

  const startsAt = parseDate(payload.startsAt, "startsAt") ?? null;
  const endsAt = parseDate(payload.endsAt, "endsAt") ?? null;
  if (startsAt && endsAt && endsAt <= startsAt) {
    throw new DiscountValidationError("endsAt must be after startsAt");
  }
  const usageLimit = parseInt0Plus(payload.usageLimit, "usageLimit") ?? null;

  const label =
    payload.label === undefined || payload.label === null || payload.label === ""
      ? null
      : String(payload.label).slice(0, 120);

  const isActive =
    payload.isActive === undefined ? true : Boolean(payload.isActive);

  const resolvedUser = await resolveUserId(db, payload);

  const data: Prisma.PromoCreateInput = {
    code,
    type,
    percent,
    amount,
    label,
    isActive,
    startsAt,
    endsAt,
    usageLimit,
  };
  if (resolvedUser && resolvedUser.userId) {
    data.user = { connect: { id: resolvedUser.userId } };
  }
  return data;
}

/** Normalised body for PATCH. Only includes fields the caller explicitly sent. */
export async function parseUpdateDiscount(
  db: Pick<PrismaClient, "user">,
  payload: DiscountPayload,
  currentType?: PromoType
): Promise<Prisma.PromoUpdateInput> {
  const data: Prisma.PromoUpdateInput = {};

  const code = parseCode(payload.code);
  if (code !== undefined) data.code = code;

  const tv = parseTypeAndValue(payload, currentType);
  if (tv.type !== undefined) data.type = tv.type;
  if (tv.percent !== undefined && tv.percent !== null) data.percent = tv.percent;
  if (tv.amount !== undefined) data.amount = tv.amount;

  const startsAt = parseDate(payload.startsAt, "startsAt");
  if (startsAt !== undefined) data.startsAt = startsAt;

  const endsAt = parseDate(payload.endsAt, "endsAt");
  if (endsAt !== undefined) data.endsAt = endsAt;

  if (
    data.startsAt instanceof Date &&
    data.endsAt instanceof Date &&
    (data.endsAt as Date) <= (data.startsAt as Date)
  ) {
    throw new DiscountValidationError("endsAt must be after startsAt");
  }

  const usageLimit = parseInt0Plus(payload.usageLimit, "usageLimit");
  if (usageLimit !== undefined) data.usageLimit = usageLimit;

  if (payload.label !== undefined) {
    data.label =
      payload.label === null || payload.label === ""
        ? null
        : String(payload.label).slice(0, 120);
  }

  if (payload.isActive !== undefined) data.isActive = Boolean(payload.isActive);

  const resolvedUser = await resolveUserId(db, payload);
  if (resolvedUser) {
    data.user =
      resolvedUser.userId === null
        ? { disconnect: true }
        : { connect: { id: resolvedUser.userId } };
  }

  return data;
}
