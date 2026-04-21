import type { BookingRecord } from "@/lib/carriers/types";

/**
 * Ephemeral in-memory booking store.
 *
 * NOTE: This resets on every server restart and does not persist across
 * serverless cold starts. Replace with a database (Postgres / Prisma,
 * Supabase, MongoDB, etc.) when the real integration lands.
 */
class BookingStore {
  private byReference = new Map<string, BookingRecord>();

  create(record: BookingRecord): BookingRecord {
    this.byReference.set(record.reference, record);
    return record;
  }

  find(reference: string): BookingRecord | undefined {
    return this.byReference.get(reference);
  }

  list(): BookingRecord[] {
    return Array.from(this.byReference.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }

  updateStatus(reference: string, status: BookingRecord["status"]): void {
    const existing = this.byReference.get(reference);
    if (existing) existing.status = status;
  }
}

/**
 * In dev, Next.js re-evaluates modules on each request, which would wipe the
 * store. We stash it on globalThis so the map survives hot reloads.
 */
const globalKey = "__asol_booking_store__" as const;
type GlobalWithStore = typeof globalThis & {
  [globalKey]?: BookingStore;
};
const g = globalThis as GlobalWithStore;

export const bookingStore: BookingStore = g[globalKey] ?? new BookingStore();
if (!g[globalKey]) g[globalKey] = bookingStore;

export function generateReference(): string {
  return `AB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
