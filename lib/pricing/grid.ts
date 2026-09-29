import type { Prisma, PrismaClient, TariffGrid } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Flexible tariff grids, one per country. Final price:
 *   tier price (by sold seat share) × month multiplier × time phase,
 * clamped to [minPrice, maxPrice].
 */

export type PriceTier = { share: number; price: number };

export type TariffGridConfig = {
  capacity: number;
  tiers: PriceTier[];
  monthMultipliers: Record<number, number>;
  earlyBirdDays: number | null;
  earlyBirdPercent: number | null;
  lastMinuteDays: number | null;
  lastMinutePercent: number | null;
  minPrice: number | null;
  maxPrice: number | null;
};

export type GridPriceBreakdown = {
  price: number;
  tierIndex: number;
  tierPrice: number;
  soldRatio: number;
  monthMultiplier: number;
  phase: "early_bird" | "last_minute" | "regular";
  phaseMultiplier: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function parseTiers(raw: string): PriceTier[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((t) => ({
        share: Number((t as PriceTier).share),
        price: Number((t as PriceTier).price),
      }))
      .filter((t) => Number.isFinite(t.share) && t.share > 0 && Number.isFinite(t.price));
  } catch {
    return [];
  }
}

export function parseMonthMultipliers(raw: string): Record<number, number> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<number, number> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>) as [string, unknown][]) {
      const month = Number(key);
      const mult = Number(value);
      if (month >= 1 && month <= 12 && Number.isFinite(mult) && mult > 0) {
        out[month] = mult;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function toGridConfig(grid: TariffGrid): TariffGridConfig {
  return {
    capacity: grid.capacity > 0 ? grid.capacity : 46,
    tiers: parseTiers(grid.tiers),
    monthMultipliers: parseMonthMultipliers(grid.monthMultipliers),
    earlyBirdDays: grid.earlyBirdDays,
    earlyBirdPercent: grid.earlyBirdPercent,
    lastMinuteDays: grid.lastMinuteDays,
    lastMinutePercent: grid.lastMinutePercent,
    minPrice: grid.minPrice,
    maxPrice: grid.maxPrice,
  };
}

export function computeGridPrice(
  config: TariffGridConfig,
  options: { soldSeats: number; departureTime: Date; now?: Date }
): GridPriceBreakdown | null {
  if (!config.tiers.length) return null;
  const now = options.now ?? new Date();

  const soldRatio = Math.min(
    1,
    Math.max(0, options.soldSeats / config.capacity)
  );
  let cumulative = 0;
  let tierIndex = config.tiers.length - 1;
  for (let i = 0; i < config.tiers.length; i += 1) {
    cumulative += config.tiers[i].share;
    if (soldRatio < cumulative) {
      tierIndex = i;
      break;
    }
  }
  const tierPrice = config.tiers[tierIndex].price;

  const month = options.departureTime.getUTCMonth() + 1;
  const monthMultiplier = config.monthMultipliers[month] ?? 1;

  const daysUntil =
    (options.departureTime.getTime() - now.getTime()) / 86_400_000;
  let phase: GridPriceBreakdown["phase"] = "regular";
  let phaseMultiplier = 1;
  if (
    config.earlyBirdDays != null &&
    config.earlyBirdPercent != null &&
    daysUntil >= config.earlyBirdDays
  ) {
    phase = "early_bird";
    phaseMultiplier = 1 - config.earlyBirdPercent / 100;
  } else if (
    config.lastMinuteDays != null &&
    config.lastMinutePercent != null &&
    daysUntil <= config.lastMinuteDays
  ) {
    phase = "last_minute";
    phaseMultiplier = 1 + config.lastMinutePercent / 100;
  }

  let price = tierPrice * monthMultiplier * phaseMultiplier;
  if (config.minPrice != null) price = Math.max(config.minPrice, price);
  if (config.maxPrice != null) price = Math.min(config.maxPrice, price);

  return {
    price: round2(price),
    tierIndex,
    tierPrice,
    soldRatio: round2(soldRatio),
    monthMultiplier,
    phase,
    phaseMultiplier,
  };
}

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Resolve the grid for a trip: the destination country's grid, or — for
 * corridors back to Ukraine — the foreign origin country's grid.
 */
export async function getGridForTrip(
  db: Db,
  tripId: string
): Promise<TariffGridConfig | null> {
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: {
      departure: {
        select: {
          template: {
            select: {
              country: { select: { id: true, code: true } },
              originCountry: { select: { id: true, code: true } },
            },
          },
        },
      },
    },
  });
  const template = trip?.departure?.template;
  if (!template) return null;

  const destination = template.country;
  const origin = template.originCountry ?? null;
  const preferred =
    destination.code === "UA" && origin ? origin : destination;

  let grid = await db.tariffGrid.findUnique({
    where: { countryId: preferred.id },
  });
  if ((!grid || !grid.isActive) && origin && origin.id !== preferred.id) {
    grid = await db.tariffGrid.findUnique({ where: { countryId: origin.id } });
  }
  if ((!grid || !grid.isActive) && destination.id !== preferred.id) {
    grid = await db.tariffGrid.findUnique({
      where: { countryId: destination.id },
    });
  }
  if (!grid || !grid.isActive) return null;
  return toGridConfig(grid);
}

/** Active tickets occupying the coach (outbound or return direction). */
export async function soldSeatCount(db: Db, tripId: string): Promise<number> {
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      fromCity: true,
      departureId: true,
      departure: {
        select: { template: { select: { destinationCity: true } } },
      },
    },
  });
  if (!trip) return 0;
  let ids = [trip.id];
  if (trip.departureId && trip.departure?.template) {
    const destination = trip.departure.template.destinationCity;
    const siblings = await db.trip.findMany({
      where: { departureId: trip.departureId },
      select: { id: true, fromCity: true },
    });
    const isReturn = trip.fromCity === destination;
    ids = siblings
      .filter((t) =>
        isReturn ? t.fromCity === destination : t.fromCity !== destination
      )
      .map((t) => t.id);
  }
  return db.ticket.count({
    where: {
      status: { in: ["RESERVED", "AWAITING_PAYMENT", "PAID_ONLINE", "PAID_CASH"] },
      OR: [{ tripId: { in: ids } }, { returnTripId: { in: ids } }],
    },
  });
}

/**
 * Authoritative current price for a stored trip: grid price when the
 * departure's country has an active grid, otherwise the flat trip price.
 */
export async function priceForTrip(
  db: Db,
  trip: { id: string; price: number; departureTime: Date }
): Promise<{ price: number; breakdown: GridPriceBreakdown | null }> {
  const grid = await getGridForTrip(db, trip.id);
  if (!grid) return { price: trip.price, breakdown: null };
  const sold = await soldSeatCount(db, trip.id);
  const breakdown = computeGridPrice(grid, {
    soldSeats: sold,
    departureTime: trip.departureTime,
  });
  if (!breakdown) return { price: trip.price, breakdown: null };
  return { price: breakdown.price, breakdown };
}

export async function listGrids(db: Db = prisma) {
  return db.tariffGrid.findMany({ include: { country: true } });
}
