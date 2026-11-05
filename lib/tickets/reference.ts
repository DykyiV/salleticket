import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Ticket numbers: two fixed letters + hyphen + five digits (KR-12345,
 * Kaufmann Reisen; tickets issued before the rebrand keep AB-…).
 * The letters never change; search matches by the digit part.
 */
export const REFERENCE_PATTERN = /^KR-\d{5}$/;

export function generateReference(): string {
  const digits = Math.floor(Math.random() * 100_000)
    .toString()
    .padStart(5, "0");
  return `KR-${digits}`;
}

type Db = PrismaClient | Prisma.TransactionClient;

/** Generate a reference that no booking uses yet. */
export async function uniqueReference(db: Db): Promise<string> {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const reference = generateReference();
    const existing = await db.booking.findUnique({
      where: { reference },
      select: { id: true },
    });
    if (!existing) return reference;
  }
  throw new Error("Не вдалося згенерувати номер квитка");
}
