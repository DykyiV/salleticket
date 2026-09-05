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

type RouteSeed = {
  name: string;
  fromCity: string;
  toCity: string;
  carrierName: string;
  departureTime: string;
  daysOfWeek: number[];
  basePrice: number;
  busCapacity: number;
  busType: string;
  amenities: string[];
  stops: { city: string; address?: string; offsetMinutes: number }[];
};

const ROUTES: RouteSeed[] = [
  {
    name: "Київ — Львів",
    fromCity: "Київ",
    toCity: "Львів",
    carrierName: "Asol Express",
    departureTime: "08:00",
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    basePrice: 12,
    busCapacity: 45,
    busType: "Neoplan Cityliner",
    amenities: ["Wi-Fi", "USB", "A/C"],
    stops: [
      { city: "Київ", address: "АВ, вул. Курчатова, 10", offsetMinutes: 0 },
      { city: "Житомир", address: "АС вул. Київська 93", offsetMinutes: 90 },
      { city: "Рівне", address: "АС, вул. Київська 40", offsetMinutes: 240 },
      { city: "Львів", address: "АС №2, вул. Городоцька", offsetMinutes: 420 },
    ],
  },
  {
    name: "Одеса — Харків",
    fromCity: "Одеса",
    toCity: "Харків",
    carrierName: "Grandes Tour",
    departureTime: "22:00",
    daysOfWeek: [2, 5, 7],
    basePrice: 18,
    busCapacity: 45,
    busType: "Mercedes Tourismo",
    amenities: ["Wi-Fi", "USB", "A/C", "WC"],
    stops: [
      { city: "Одеса", address: "Автовокзал Привоз", offsetMinutes: 0 },
      { city: "Кропивницький", address: "АС вул. Олександрійське шосе, 1", offsetMinutes: 240 },
      { city: "Полтава", address: "АВ, вул. Великотирнівська, 7", offsetMinutes: 480 },
      { city: "Харків", address: "АВ, просп. Гагаріна, 22", offsetMinutes: 600 },
    ],
  },
  {
    name: "Вінниця — Севілья",
    fromCity: "Вінниця",
    toCity: "Севілья",
    carrierName: "Grandes Tour",
    departureTime: "19:30",
    daysOfWeek: [2, 5],
    basePrice: 145,
    busCapacity: 51,
    busType: "Setra ComfortClass",
    amenities: ["Wi-Fi", "USB", "A/C", "WC", "Recliner"],
    stops: [
      { city: "Вінниця", address: "АС, вул. Київська, 8", offsetMinutes: 0 },
      { city: "Хмельницький", address: "АС вул. Вінницьке Шосе, 23", offsetMinutes: 120 },
      { city: "Львів", address: "АС №2, вул. Городоцька, 145Б", offsetMinutes: 360 },
      { city: "Валенсія", address: "AC вул. Мендез Підал, 11", offsetMinutes: 2700 },
      { city: "Севілья", address: "AC Пласа де Армас", offsetMinutes: 3060 },
    ],
  },
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

  for (const r of ROUTES) {
    const existing = await prisma.route.findFirst({ where: { name: r.name } });
    if (existing) {
      console.log(`  route "${r.name}" already exists, skipping`);
      continue;
    }
    const carrier = await prisma.carrier.upsert({
      where: { name: r.carrierName },
      update: {},
      create: { name: r.carrierName, rating: 4.5 },
    });
    await prisma.route.create({
      data: {
        name: r.name,
        fromCity: r.fromCity,
        toCity: r.toCity,
        carrierId: carrier.id,
        departureTime: r.departureTime,
        daysOfWeek: r.daysOfWeek.join(","),
        basePrice: r.basePrice,
        busCapacity: r.busCapacity,
        busType: r.busType,
        amenities: r.amenities.join(","),
        isActive: true,
        stops: {
          create: r.stops.map((s, i) => ({
            order: i,
            city: s.city,
            address: s.address ?? null,
            offsetMinutes: s.offsetMinutes,
          })),
        },
      },
    });
    console.log(`  created route "${r.name}"`);
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
