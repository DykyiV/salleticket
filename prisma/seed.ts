/**
 * Database seed. Idempotent — safe to run repeatedly.
 *
 * Run with:  npm run db:seed
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type PromoSeed = {
  code: string;
  percent: number;
  label: string;
  isActive?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  usageLimit?: number | null;
};

const PROMOS: PromoSeed[] = [
  { code: "DISCOUNT10", percent: 0.1, label: "10% off" },
  { code: "VIP20", percent: 0.2, label: "VIP · 20% off" },
];

type CarrierSeed = {
  name: string;
  rating: number;
  /** Default agency commission, percent 0..100. */
  commissionPercent: number;
  /** Route-specific overrides. */
  rules?: { fromCity: string; toCity: string; percent: number }[];
};

const CARRIERS: CarrierSeed[] = [
  {
    name: "Grandes Tour",
    rating: 4.7,
    commissionPercent: 12,
    rules: [{ fromCity: "Kyiv", toCity: "Lviv", percent: 20 }],
  },
  { name: "Asol Express", rating: 4.5, commissionPercent: 15 },
  { name: "EuroLines Plus", rating: 4.2, commissionPercent: 10 },
  { name: "SkyLine Airlines", rating: 4.6, commissionPercent: 8 },
  { name: "AirUkraine", rating: 4.8, commissionPercent: 9 },
  { name: "UkrRail Express", rating: 4.5, commissionPercent: 10 },
  { name: "EuroRail", rating: 4.6, commissionPercent: 11 },
];

async function main() {
  for (const p of PROMOS) {
    await prisma.promo.upsert({
      where: { code: p.code },
      create: {
        code: p.code,
        percent: p.percent,
        label: p.label,
        isActive: p.isActive ?? true,
        startsAt: p.startsAt ?? null,
        endsAt: p.endsAt ?? null,
        usageLimit: p.usageLimit ?? null,
      },
      update: {
        percent: p.percent,
        label: p.label,
        isActive: p.isActive ?? true,
      },
    });
    console.log(`  upserted promo ${p.code}`);
  }

  for (const c of CARRIERS) {
    const carrier = await prisma.carrier.upsert({
      where: { name: c.name },
      create: {
        name: c.name,
        rating: c.rating,
        commissionPercent: c.commissionPercent,
      },
      update: { commissionPercent: c.commissionPercent },
    });
    console.log(`  upserted carrier ${c.name} (${c.commissionPercent}% default)`);

    for (const rule of c.rules ?? []) {
      await prisma.commissionRule.upsert({
        where: {
          carrierId_fromCity_toCity: {
            carrierId: carrier.id,
            fromCity: rule.fromCity,
            toCity: rule.toCity,
          },
        },
        create: {
          carrierId: carrier.id,
          fromCity: rule.fromCity,
          toCity: rule.toCity,
          percent: rule.percent,
        },
        update: { percent: rule.percent },
      });
      console.log(
        `    rule ${rule.fromCity} → ${rule.toCity}: ${rule.percent}%`
      );
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
