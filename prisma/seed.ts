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
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
