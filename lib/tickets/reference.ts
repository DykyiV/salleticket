import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Ticket numbers: two fixed letters + hyphen + five digits (AB-12345).
 * The letters never change; search matches by the digit part.
 */
export const REFERENCE_PATTERN = /^AB-\d{5}$/;

export function generateReference(): string {
  const digits = Math.floor(Math.random() * 100_000)
    .toString()
    .padStart(5, "0");
  return `AB-${digits}`;
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
