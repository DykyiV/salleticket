import type { Prisma, PrismaClient } from "@prisma/client";

export type DiscountCardPayload = {
  percent?: unknown;
  isActive?: unknown;
  userEmail?: unknown;
};

export class DiscountCardValidationError extends Error {}

function parsePercent(input: unknown): number {
  let n: number;
  if (typeof input === "number") n = input;
  else n = Number.parseFloat(String(input));
  if (!Number.isFinite(n)) {
    throw new DiscountCardValidationError("percent must be a number");
  }
  if (n >= 1) n = n / 100; // accept "10" as 10%
  if (n <= 0 || n >= 1) {
    throw new DiscountCardValidationError("percent must be > 0 and < 1 (e.g. 0.1 for 10%)");
  }
  return Math.round(n * 10000) / 10000;
}

async function resolveUserId(
  db: Pick<PrismaClient, "user">,
  userEmail: unknown
): Promise<string> {
  if (typeof userEmail !== "string" || !userEmail.trim()) {
    throw new DiscountCardValidationError("userEmail is required");
  }
  const user = await db.user.findUnique({
    where: { email: userEmail.trim().toLowerCase() },
    select: { id: true },
  });
  if (!user) {
    throw new DiscountCardValidationError(`No user found with email ${userEmail}`);
  }
  return user.id;
}

function randomCode(): string {
  return `DC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function parseCreateDiscountCard(
  db: Pick<PrismaClient, "user">,
  payload: DiscountCardPayload
): Promise<Prisma.DiscountCardCreateInput> {
  if (payload.percent === undefined) {
    throw new DiscountCardValidationError("percent is required");
  }
  const percent = parsePercent(payload.percent);
  const userId = await resolveUserId(db, payload.userEmail);
  const isActive = payload.isActive === undefined ? true : Boolean(payload.isActive);

  return {
    code: randomCode(),
    percent,
    isActive,
    source: "MANUAL",
    user: { connect: { id: userId } },
  };
}

export async function parseUpdateDiscountCard(
  payload: DiscountCardPayload
): Promise<Prisma.DiscountCardUpdateInput> {
  const data: Prisma.DiscountCardUpdateInput = {};
  if (payload.percent !== undefined) data.percent = parsePercent(payload.percent);
  if (payload.isActive !== undefined) data.isActive = Boolean(payload.isActive);
  return data;
}
