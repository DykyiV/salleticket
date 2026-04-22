import { Prisma, type PrismaClient } from "@prisma/client";

export type DiscountPayload = {
  code?: unknown;
  percent?: unknown;
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
  const percent = parsePercent(payload.percent);
  if (percent === undefined) {
    throw new DiscountValidationError("percent is required");
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
    percent,
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
  payload: DiscountPayload
): Promise<Prisma.PromoUpdateInput> {
  const data: Prisma.PromoUpdateInput = {};

  const code = parseCode(payload.code);
  if (code !== undefined) data.code = code;

  const percent = parsePercent(payload.percent);
  if (percent !== undefined) data.percent = percent;

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
