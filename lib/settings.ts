import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

export type SiteSettings = {
  /** Percent off the ticket price when paying online (0–100). */
  onlineDiscountPercent: number;
  /** Minutes the site waits for funds to arrive after the client pays. */
  paymentSettleMinutes: number;
  /** Hours the client has to pay online before the discount expires. */
  paymentDeadlineHours: number;
  /** Minutes a selected seat stays locked for the booking session. */
  seatHoldMinutes: number;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  onlineDiscountPercent: 5,
  paymentSettleMinutes: 25,
  paymentDeadlineHours: 24,
  seatHoldMinutes: 15,
};

const KEYS: Record<keyof SiteSettings, string> = {
  onlineDiscountPercent: "onlineDiscountPercent",
  paymentSettleMinutes: "paymentSettleMinutes",
  paymentDeadlineHours: "paymentDeadlineHours",
  seatHoldMinutes: "seatHoldMinutes",
};

type Db = PrismaClient | Prisma.TransactionClient;

function toNumber(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function getSiteSettings(db: Db = prisma): Promise<SiteSettings> {
  const rows = await db.siteSetting.findMany({
    where: { key: { in: Object.values(KEYS) } },
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    onlineDiscountPercent: toNumber(
      map.get(KEYS.onlineDiscountPercent),
      DEFAULT_SITE_SETTINGS.onlineDiscountPercent
    ),
    paymentSettleMinutes: toNumber(
      map.get(KEYS.paymentSettleMinutes),
      DEFAULT_SITE_SETTINGS.paymentSettleMinutes
    ),
    paymentDeadlineHours: toNumber(
      map.get(KEYS.paymentDeadlineHours),
      DEFAULT_SITE_SETTINGS.paymentDeadlineHours
    ),
    seatHoldMinutes: toNumber(
      map.get(KEYS.seatHoldMinutes),
      DEFAULT_SITE_SETTINGS.seatHoldMinutes
    ),
  };
}

export async function updateSiteSettings(
  patch: Partial<SiteSettings>,
  db: Db = prisma
): Promise<SiteSettings> {
  for (const key of Object.keys(KEYS) as (keyof SiteSettings)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    if (!Number.isFinite(value) || value < 0) continue;
    await db.siteSetting.upsert({
      where: { key: KEYS[key] },
      create: { key: KEYS[key], value: String(value) },
      update: { value: String(value) },
    });
  }
  return getSiteSettings(db);
}

/** Discounted online price for a ticket price that already includes age/promo. */
export function applyOnlineDiscount(
  price: number,
  settings: SiteSettings
): number {
  const pct = Math.min(100, Math.max(0, settings.onlineDiscountPercent));
  return Math.round(price * (1 - pct / 100) * 100) / 100;
}
