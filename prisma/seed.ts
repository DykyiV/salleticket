/**
 * Database seed. Idempotent — safe to run repeatedly.
 *
 * Run with:  npm run db:seed
 */
import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../lib/auth/password";
import { stringifyWeekdays } from "../lib/routes/weekdays";
import { generateDepartures } from "../lib/routes/generate";
import { addUtcDays, todayUtc } from "../lib/routes/dates";

const prisma = new PrismaClient();

type PromoSeed = {
  code: string;
  percent: number;
  label: string;
  isActive?: boolean;
};

const PROMOS: PromoSeed[] = [
  { code: "DISCOUNT10", percent: 0.1, label: "10% off" },
  { code: "VIP20", percent: 0.2, label: "VIP · 20% off" },
];

async function upsertUser(email: string, password: string, role: Role, flags = {}) {
  const hash = await hashPassword(password);
  return prisma.user.upsert({
    where: { email },
    create: { email, password: hash, role, ...flags },
    update: { role, ...flags },
  });
}

async function main() {
  for (const p of PROMOS) {
    await prisma.promo.upsert({
      where: { code: p.code },
      create: {
        code: p.code,
        percent: p.percent,
        label: p.label,
        isActive: p.isActive ?? true,
      },
      update: {
        percent: p.percent,
        label: p.label,
        isActive: p.isActive ?? true,
      },
    });
    console.log(`  upserted promo ${p.code}`);
  }

  await upsertUser("admin@asolbus.local", "Admin12345", "ADMIN", {
    displayName: "Адміністратор",
  });
  await upsertUser("agent@asolbus.local", "Agent12345", "AGENT", {
    displayName: "Агент",
    canEditDepartures: true,
    canHideStops: true,
    canHideSeats: true,
  });
  console.log("  upserted admin@asolbus.local / agent@asolbus.local");

  const ukraine = await prisma.country.upsert({
    where: { name: "Україна" },
    create: { name: "Україна", code: "UA", sortOrder: 1 },
    update: { code: "UA", sortOrder: 1 },
  });
  const spain = await prisma.country.upsert({
    where: { name: "Іспанія" },
    create: { name: "Іспанія", code: "ES", sortOrder: 2 },
    update: { code: "ES", sortOrder: 2 },
  });
  const poland = await prisma.country.upsert({
    where: { name: "Польща" },
    create: { name: "Польща", code: "PL", sortOrder: 3 },
    update: { code: "PL", sortOrder: 3 },
  });
  const germany = await prisma.country.upsert({
    where: { name: "Німеччина" },
    create: { name: "Німеччина", code: "DE", sortOrder: 4 },
    update: { code: "DE", sortOrder: 4 },
  });

  await prisma.routeTemplate.updateMany({
    where: { originCountryId: null, NOT: { countryId: ukraine.id } },
    data: { originCountryId: ukraine.id },
  });

  let template = await prisma.routeTemplate.findFirst({
    where: { name: "Київ — Марбелья", countryId: spain.id },
  });
  if (!template) {
    template = await prisma.routeTemplate.create({
      data: {
        countryId: spain.id,
        originCountryId: ukraine.id,
        name: "Київ — Марбелья",
        originCity: "Київ",
        destinationCity: "Марбелья",
        departureWeekdays: stringifyWeekdays([2, 4]),
        busPhone: "+380671112233",
        dispatcherPhone: "+380501112233",
        ukraineDepartureWeekday: 2,
        ukraineReturnWeekday: 6,
        defaultBus: "Mercedes Tourismo AA 1234 XX",
        comment: "Сезонний маршрут. У четвер Марбелья може не заїжджати.",
        stops: {
          create: [
            {
              sortOrder: 1,
              city: "Київ",
              outboundDay: 1,
              outboundTime: "08:00",
              returnDay: 5,
              returnTime: "22:00",
              addressLabel: "Київ, Центральний автовокзал",
              boardingAddress: "вул. Симона Петлюри, 32",
              latitude: 50.4408,
              longitude: 30.4892,
              visibleByDefault: true,
            },
            {
              sortOrder: 2,
              city: "Львів",
              outboundDay: 1,
              outboundTime: "16:30",
              returnDay: 5,
              returnTime: "14:00",
              addressLabel: "Львів, автовокзал",
              boardingAddress: "вул. Стрийська, 109",
              visibleByDefault: true,
            },
            {
              sortOrder: 3,
              city: "Краків",
              outboundDay: 1,
              outboundTime: "22:00",
              returnDay: 5,
              returnTime: "08:30",
              addressLabel: "Kraków MDA",
              boardingAddress: "ul. Bosacka 18, Kraków",
              visibleByDefault: true,
            },
            {
              sortOrder: 4,
              city: "Барселона",
              outboundDay: 3,
              outboundTime: "09:00",
              returnDay: 3,
              returnTime: "18:00",
              addressLabel: "Barcelona Nord",
              boardingAddress: "Carrer d'Alí Bei, 80",
              visibleByDefault: true,
            },
            {
              sortOrder: 5,
              city: "Марбелья",
              outboundDay: 3,
              outboundTime: "16:00",
              returnDay: 3,
              returnTime: "12:00",
              addressLabel: "Marbella bus station",
              boardingAddress: "Av. del Trapiche, Marbella",
              latitude: 36.5105,
              longitude: -4.8826,
              visibleByDefault: true,
            },
          ],
        },
      },
    });
    console.log("  created template Київ — Марбелья");
  } else if (!template.originCountryId) {
    template = await prisma.routeTemplate.update({
      where: { id: template.id },
      data: { originCountryId: ukraine.id },
    });
  }

  const generated = await generateDepartures({
    templateId: template.id,
    from: todayUtc(),
    to: addUtcDays(todayUtc(), 56),
  });
  console.log(
    `  generated departures: created=${generated.created} skipped=${generated.skipped}`
  );

  await seedCorridor({
    name: "Київ — Берлін",
    originCountryId: ukraine.id,
    destinationCountryId: germany.id,
    originCity: "Київ",
    destinationCity: "Берлін",
    weekdays: [2],
    stops: [
      { city: "Київ", outboundTime: "07:00", returnTime: "23:00", day: 1 },
      { city: "Львів", outboundTime: "15:00", returnTime: "14:00", day: 1 },
      { city: "Берлін", outboundTime: "06:00", returnTime: "20:00", day: 2 },
    ],
  });

  await seedCorridor({
    name: "Берлін — Київ",
    originCountryId: germany.id,
    destinationCountryId: ukraine.id,
    originCity: "Берлін",
    destinationCity: "Київ",
    weekdays: [2],
    stops: [
      { city: "Берлін", outboundTime: "08:00", returnTime: "22:00", day: 1 },
      { city: "Львів", outboundTime: "20:00", returnTime: "10:00", day: 1 },
      { city: "Київ", outboundTime: "08:00", returnTime: "18:00", day: 2 },
    ],
  });

  void poland;
}

type CorridorStop = {
  city: string;
  outboundTime: string;
  returnTime: string;
  day: number;
};

async function seedCorridor(options: {
  name: string;
  originCountryId: string;
  destinationCountryId: string;
  originCity: string;
  destinationCity: string;
  weekdays: number[];
  stops: CorridorStop[];
}) {
  let template = await prisma.routeTemplate.findFirst({
    where: { name: options.name, countryId: options.destinationCountryId },
  });
  if (!template) {
    template = await prisma.routeTemplate.create({
      data: {
        countryId: options.destinationCountryId,
        originCountryId: options.originCountryId,
        name: options.name,
        originCity: options.originCity,
        destinationCity: options.destinationCity,
        departureWeekdays: stringifyWeekdays(options.weekdays),
        ukraineDepartureWeekday: options.weekdays[0] ?? 2,
        defaultBus: "Setra S 516 HD",
        stops: {
          create: options.stops.map((stop, index) => ({
            sortOrder: index + 1,
            city: stop.city,
            outboundDay: stop.day,
            outboundTime: stop.outboundTime,
            returnDay: stop.day,
            returnTime: stop.returnTime,
            visibleByDefault: true,
          })),
        },
      },
    });
    console.log(`  created template ${options.name}`);
  } else if (!template.originCountryId) {
    template = await prisma.routeTemplate.update({
      where: { id: template.id },
      data: { originCountryId: options.originCountryId },
    });
  }

  const generated = await generateDepartures({
    templateId: template.id,
    from: todayUtc(),
    to: addUtcDays(todayUtc(), 56),
  });
  console.log(
    `  generated ${options.name}: created=${generated.created} skipped=${generated.skipped}`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
