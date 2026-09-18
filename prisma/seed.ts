/**
 * Database seed. Idempotent — safe to run repeatedly.
 *
 * Run with:  npm run db:seed
 */
import { AgeCategory, PaymentStatus, PrismaClient, Role, TicketStatus, TripKind } from "@prisma/client";
import { hashPassword } from "../lib/auth/password";
import { stringifyWeekdays } from "../lib/routes/weekdays";
import { generateDepartures } from "../lib/routes/generate";
import { addUtcDays, combineUtcDateTime, todayUtc } from "../lib/routes/dates";
import { computePrice, type AgeCategoryId } from "../lib/pricing";
import { DEFAULT_SITE_SETTINGS } from "../lib/settings";
import { recordTicketHistory } from "../lib/tickets/history";

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

  for (const [key, value] of Object.entries(DEFAULT_SITE_SETTINGS)) {
    await prisma.siteSetting.upsert({
      where: { key },
      create: { key, value: String(value) },
      update: {},
    });
  }
  console.log("  upserted site settings (online discount, payment windows, seat hold)");

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

  const GRIDS: Array<{
    countryId: string;
    tiers: { share: number; price: number }[];
    months: Record<number, number>;
    earlyBirdDays: number;
    earlyBirdPercent: number;
    lastMinuteDays: number;
    lastMinutePercent: number;
    minPrice: number;
    maxPrice: number;
  }> = [
    {
      countryId: germany.id,
      tiers: [
        { share: 0.5, price: 40 },
        { share: 0.25, price: 60 },
        { share: 0.25, price: 90 },
      ],
      months: { 1: 1.2, 2: 0.85, 10: 0.85 },
      earlyBirdDays: 60,
      earlyBirdPercent: 25,
      lastMinuteDays: 5,
      lastMinutePercent: 15,
      minPrice: 30,
      maxPrice: 150,
    },
    {
      countryId: spain.id,
      tiers: [
        { share: 0.5, price: 45 },
        { share: 0.25, price: 65 },
        { share: 0.25, price: 95 },
      ],
      months: { 1: 0.9, 7: 1.15, 8: 1.15 },
      earlyBirdDays: 30,
      earlyBirdPercent: 15,
      lastMinuteDays: 2,
      lastMinutePercent: 10,
      minPrice: 35,
      maxPrice: 160,
    },
  ];
  for (const grid of GRIDS) {
    await prisma.tariffGrid.upsert({
      where: { countryId: grid.countryId },
      create: {
        countryId: grid.countryId,
        capacity: 46,
        tiers: JSON.stringify(grid.tiers),
        monthMultipliers: JSON.stringify(grid.months),
        earlyBirdDays: grid.earlyBirdDays,
        earlyBirdPercent: grid.earlyBirdPercent,
        lastMinuteDays: grid.lastMinuteDays,
        lastMinutePercent: grid.lastMinutePercent,
        minPrice: grid.minPrice,
        maxPrice: grid.maxPrice,
      },
      update: {},
    });
  }
  console.log("  upserted tariff grids (Німеччина, Іспанія)");

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
      {
        city: "Київ",
        outboundTime: "07:00",
        returnTime: "23:00",
        day: 1,
        addressLabel: "Київ, Центральний автовокзал",
        boardingAddress: "вул. Симона Петлюри, 32",
        latitude: 50.4408,
        longitude: 30.4892,
      },
      {
        city: "Львів",
        outboundTime: "15:00",
        returnTime: "14:00",
        day: 1,
        addressLabel: "Львів, автовокзал",
        boardingAddress: "вул. Стрийська, 109",
      },
      {
        city: "Берлін",
        outboundTime: "06:00",
        returnTime: "20:00",
        day: 2,
        addressLabel: "ZOB Berlin",
        boardingAddress: "Messedamm 8, 14055 Berlin",
        latitude: 52.5074,
        longitude: 13.2795,
      },
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
      {
        city: "Берлін",
        outboundTime: "08:00",
        returnTime: "22:00",
        day: 1,
        addressLabel: "ZOB Berlin",
        boardingAddress: "Messedamm 8, 14055 Berlin",
        latitude: 52.5074,
        longitude: 13.2795,
      },
      {
        city: "Львів",
        outboundTime: "20:00",
        returnTime: "10:00",
        day: 1,
        addressLabel: "Львів, автовокзал",
        boardingAddress: "вул. Стрийська, 109",
      },
      {
        city: "Київ",
        outboundTime: "08:00",
        returnTime: "18:00",
        day: 2,
        addressLabel: "Київ, Центральний автовокзал",
        boardingAddress: "вул. Симона Петлюри, 32",
        latitude: 50.4408,
        longitude: 30.4892,
      },
    ],
  });

  await seedDemoTickets();

  void poland;
}

type CorridorStop = {
  city: string;
  outboundTime: string;
  returnTime: string;
  day: number;
  addressLabel?: string;
  boardingAddress?: string;
  latitude?: number;
  longitude?: number;
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
        busPhone: "+380671112233",
        dispatcherPhone: "+380501112233",
        stops: {
          create: options.stops.map((stop, index) => ({
            sortOrder: index + 1,
            city: stop.city,
            outboundDay: stop.day,
            outboundTime: stop.outboundTime,
            returnDay: stop.day,
            returnTime: stop.returnTime,
            addressLabel: stop.addressLabel,
            boardingAddress: stop.boardingAddress,
            latitude: stop.latitude,
            longitude: stop.longitude,
            visibleByDefault: true,
          })),
        },
      },
    });
    console.log(`  created template ${options.name}`);
  } else {
    const patch: {
      originCountryId?: string;
      busPhone?: string;
      dispatcherPhone?: string;
    } = {};
    if (!template.originCountryId) patch.originCountryId = options.originCountryId;
    if (!template.busPhone) patch.busPhone = "+380671112233";
    if (!template.dispatcherPhone) patch.dispatcherPhone = "+380501112233";
    if (Object.keys(patch).length) {
      template = await prisma.routeTemplate.update({
        where: { id: template.id },
        data: patch,
      });
    }
    await backfillStopAddresses(template.id, options.stops);
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

async function backfillStopAddresses(templateId: string, stops: CorridorStop[]) {
  for (const stop of stops) {
    if (!stop.boardingAddress && !stop.addressLabel) continue;
    await prisma.routeTemplateStop.updateMany({
      where: {
        templateId,
        city: stop.city,
        boardingAddress: null,
      },
      data: {
        addressLabel: stop.addressLabel,
        boardingAddress: stop.boardingAddress,
        latitude: stop.latitude,
        longitude: stop.longitude,
      },
    });
    await prisma.departureStop.updateMany({
      where: {
        city: stop.city,
        boardingAddress: null,
        departure: { templateId },
      },
      data: {
        addressLabel: stop.addressLabel,
        boardingAddress: stop.boardingAddress,
        latitude: stop.latitude,
        longitude: stop.longitude,
      },
    });
  }
  await prisma.departure.updateMany({
    where: { templateId, busPhone: null },
    data: {
      busPhone: "+380671112233",
      dispatcherPhone: "+380501112233",
    },
  });
}

async function findOrCreateTripForRoute(routeName: string) {
  const now = todayUtc();
  const upcoming = await prisma.trip.findFirst({
    where: {
      departure: { template: { name: routeName } },
      departureTime: { gte: now },
    },
    orderBy: { departureTime: "asc" },
  });
  if (upcoming) return upcoming;

  const departure = await prisma.departure.findFirst({
    where: { template: { name: routeName }, date: { gte: now } },
    include: {
      trips: true,
      template: { include: { stops: { orderBy: { sortOrder: "asc" } } } },
    },
    orderBy: { date: "asc" },
  });
  if (!departure) {
    throw new Error(`Немає виїзду для ${routeName}`);
  }
  if (departure.trips[0]) return departure.trips[0];

  const first = departure.template.stops[0];
  const last = departure.template.stops[departure.template.stops.length - 1];
  if (!first || !last) {
    throw new Error(`У шаблоні ${routeName} немає зупинок`);
  }
  const carrier = await prisma.carrier.upsert({
    where: { name: "Asol BUS" },
    create: { name: "Asol BUS", rating: 4.8 },
    update: {},
  });
  return prisma.trip.create({
    data: {
      fromCity: departure.template.originCity,
      toCity: departure.template.destinationCity,
      departureTime: combineUtcDateTime(
        departure.date,
        first.outboundDay,
        first.outboundTime
      ),
      arrivalTime: combineUtcDateTime(
        departure.date,
        last.outboundDay,
        last.outboundTime
      ),
      price: 99,
      carrierId: carrier.id,
      departureId: departure.id,
    },
  });
}

async function seedDemoTickets() {
  const admin = await prisma.user.findUnique({
    where: { email: "admin@asolbus.local" },
  });
  if (!admin) {
    throw new Error("admin@asolbus.local не знайдено");
  }

  const demos: Array<{
    reference: string;
    legacyReferences?: string[];
    routeName: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    ageCategory: AgeCategory;
    status: TicketStatus;
    promoCode: string | null;
    seatNumber: number;
    tripKind: TripKind;
  }> = [
    {
      reference: "AB-10001",
      legacyReferences: ["AB-DEMO01"],
      routeName: "Київ — Марбелья",
      firstName: "Олена",
      lastName: "Коваленко",
      phone: "+380671234567",
      email: "olena.kovalenko@example.com",
      ageCategory: AgeCategory.ADULT,
      status: TicketStatus.RESERVED,
      promoCode: null,
      seatNumber: 7,
      tripKind: TripKind.ONE_WAY,
    },
    {
      reference: "AB-10002",
      legacyReferences: ["AB-DEMO02"],
      routeName: "Київ — Берлін",
      firstName: "Іван",
      lastName: "Петренко",
      phone: "+380509876543",
      email: "ivan.petrenko@example.com",
      ageCategory: AgeCategory.CHILD_5_12,
      status: TicketStatus.PAID_ONLINE,
      promoCode: "DISCOUNT10",
      seatNumber: 12,
      tripKind: TripKind.ONE_WAY,
    },
    {
      reference: "AB-10003",
      legacyReferences: ["AB-DEMO03"],
      routeName: "Берлін — Київ",
      firstName: "Марія",
      lastName: "Шевченко",
      phone: "+380931112233",
      email: "maria.shevchenko@example.com",
      ageCategory: AgeCategory.SENIOR_60,
      status: TicketStatus.PAID_CASH,
      promoCode: null,
      seatNumber: 18,
      tripKind: TripKind.ONE_WAY,
    },
    {
      reference: "AB-10004",
      legacyReferences: ["AB-DEMO04"],
      routeName: "Київ — Марбелья",
      firstName: "Тарас",
      lastName: "Бондар",
      phone: "+380671000111",
      email: "taras.bondar@example.com",
      ageCategory: AgeCategory.ADULT,
      status: TicketStatus.RESERVED,
      promoCode: null,
      seatNumber: 21,
      tripKind: TripKind.OPEN_RETURN,
    },
    {
      reference: "AB-10005",
      legacyReferences: ["AB-DEMO05"],
      routeName: "Київ — Берлін",
      firstName: "Наталія",
      lastName: "Мельник",
      phone: "+380671555444",
      email: "natalia.melnyk@example.com",
      ageCategory: AgeCategory.ADULT,
      status: TicketStatus.AWAITING_PAYMENT,
      promoCode: null,
      seatNumber: 3,
      tripKind: TripKind.ONE_WAY,
    },
  ];

  for (const demo of demos) {
    // Renumber legacy AB-DEMOnn references to the AB-12345 format.
    for (const legacy of demo.legacyReferences ?? []) {
      const legacyRow = await prisma.booking.findUnique({
        where: { reference: legacy },
      });
      if (legacyRow) {
        await prisma.booking.update({
          where: { id: legacyRow.id },
          data: { reference: demo.reference },
        });
        console.log(`  renumbered ${legacy} → ${demo.reference}`);
      }
    }

    const existing = await prisma.booking.findUnique({
      where: { reference: demo.reference },
    });
    if (existing) {
      await prisma.ticket.update({
        where: { id: existing.ticketId },
        data: {
          seatNumber: demo.seatNumber,
          tripKind: demo.tripKind,
        },
      });
      console.log(`  demo ticket ${demo.reference} already exists — seat ${demo.seatNumber}`);
      continue;
    }

    const trip = await findOrCreateTripForRoute(demo.routeName);
    const promo = demo.promoCode
      ? await prisma.promo.findUnique({ where: { code: demo.promoCode } })
      : null;
    const pricing = computePrice(
      trip.price,
      demo.ageCategory as AgeCategoryId,
      promo
    );

    const ticket = await prisma.ticket.create({
      data: {
        userId: admin.id,
        tripId: trip.id,
        status: demo.status,
        basePrice: pricing.basePrice,
        finalPrice: pricing.finalPrice,
        seatNumber: demo.seatNumber,
        tripKind: demo.tripKind,
        booking: {
          create: {
            reference: demo.reference,
            firstName: demo.firstName,
            lastName: demo.lastName,
            ageCategory: demo.ageCategory,
            phone: demo.phone,
            email: demo.email,
            promoCode: demo.promoCode,
            finalPrice: pricing.finalPrice,
          },
        },
      },
    });

    await recordTicketHistory(prisma, {
      ticketId: ticket.id,
      action: "CREATED",
      oldStatus: null,
      newStatus: demo.status,
      source: "SYSTEM",
      changedBy: admin.id,
      changes: {
        reference: { from: null, to: demo.reference },
        status: { from: null, to: demo.status },
        passenger: {
          from: null,
          to: `${demo.firstName} ${demo.lastName}`,
        },
        trip: { from: null, to: demo.routeName },
      },
    });

    if (demo.status === TicketStatus.AWAITING_PAYMENT) {
      const discountPct = DEFAULT_SITE_SETTINGS.onlineDiscountPercent;
      const amount = Math.round(pricing.finalPrice * (1 - discountPct / 100) * 100) / 100;
      await prisma.payment.create({
        data: {
          ticketId: ticket.id,
          status: PaymentStatus.PENDING,
          amount,
          fullAmount: pricing.finalPrice,
          deadlineAt: new Date(Date.now() + DEFAULT_SITE_SETTINGS.paymentDeadlineHours * 3_600_000),
        },
      });
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { finalPrice: amount },
      });
      await prisma.booking.updateMany({
        where: { ticketId: ticket.id },
        data: { finalPrice: amount },
      });
      console.log(`  created demo ticket ${demo.reference} on ${demo.routeName} (очікує оплату ${amount}€)`);
      continue;
    }
    console.log(`  created demo ticket ${demo.reference} on ${demo.routeName}`);
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
