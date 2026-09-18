import { prisma } from "@/lib/db";
import {
  combineUtcDateTime,
  isoWeekdayUtc,
  listMatchingDates,
} from "@/lib/routes/dates";
import { parseWeekdays } from "@/lib/routes/weekdays";
import { stopCreateData } from "@/lib/routes/serialize";

export async function generateDepartures(options: {
  templateId: string;
  from: Date;
  to: Date;
}): Promise<{ created: number; skipped: number; dates: string[] }> {
  const template = await prisma.routeTemplate.findUnique({
    where: { id: options.templateId },
    include: { stops: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) {
    throw new Error("Шаблон маршруту не знайдено");
  }
  if (!template.stops.length) {
    throw new Error("Спочатку додайте міста до шаблону");
  }

  const weekdays = parseWeekdays(template.departureWeekdays);
  if (!weekdays.length) {
    throw new Error("Вкажіть дні виїзду в шаблоні");
  }

  const dates = listMatchingDates(options.from, options.to, weekdays);
  let created = 0;
  let skipped = 0;
  const createdDates: string[] = [];

  const carrier = await prisma.carrier.upsert({
    where: { name: "Asol BUS" },
    create: { name: "Asol BUS", rating: 4.8 },
    update: {},
  });

  for (const date of dates) {
    const existing = await prisma.departure.findUnique({
      where: {
        templateId_date: { templateId: template.id, date },
      },
    });
    if (existing) {
      await ensureDepartureTrips({
        departureId: existing.id,
        date,
        originCity: template.originCity,
        destinationCity: template.destinationCity,
        first: template.stops[0],
        last: template.stops[template.stops.length - 1],
        carrierId: carrier.id,
      });
      skipped += 1;
      continue;
    }

    const createdDeparture = await prisma.departure.create({
      data: {
        templateId: template.id,
        date,
        weekday: isoWeekdayUtc(date),
        busPhone: template.busPhone,
        dispatcherPhone: template.dispatcherPhone,
        defaultBus: template.defaultBus,
        comment: template.comment,
        ukraineDepartureWeekday: template.ukraineDepartureWeekday,
        ukraineReturnWeekday: template.ukraineReturnWeekday,
        hasAssignedSeats: template.hasAssignedSeats,
        stops: {
          create: template.stops.map((stop) => ({
            templateStopId: stop.id,
            ...stopCreateData(stop),
            isVisible: stop.visibleByDefault,
            saleEnabled: true,
          })),
        },
      },
    });

    await ensureDepartureTrips({
      departureId: createdDeparture.id,
      date,
      originCity: template.originCity,
      destinationCity: template.destinationCity,
      first: template.stops[0],
      last: template.stops[template.stops.length - 1],
      carrierId: carrier.id,
    });
    created += 1;
    createdDates.push(date.toISOString().slice(0, 10));
  }

  return { created, skipped, dates: createdDates };
}

type StopTimes = {
  outboundDay: number;
  outboundTime: string;
  returnDay: number;
  returnTime: string;
};

export async function ensureDepartureTrips(options: {
  departureId: string;
  date: Date;
  originCity: string;
  destinationCity: string;
  first: StopTimes;
  last: StopTimes;
  carrierId: string;
}): Promise<void> {
  const existing = await prisma.trip.findMany({
    where: { departureId: options.departureId },
    select: { fromCity: true, toCity: true },
  });
  const hasOutbound = existing.some(
    (trip) =>
      trip.fromCity === options.originCity &&
      trip.toCity === options.destinationCity
  );
  const hasReturn = existing.some(
    (trip) =>
      trip.fromCity === options.destinationCity &&
      trip.toCity === options.originCity
  );

  if (!hasOutbound) {
    await prisma.trip.create({
      data: {
        fromCity: options.originCity,
        toCity: options.destinationCity,
        departureTime: combineUtcDateTime(
          options.date,
          options.first.outboundDay,
          options.first.outboundTime
        ),
        arrivalTime: combineUtcDateTime(
          options.date,
          options.last.outboundDay,
          options.last.outboundTime
        ),
        price: 99,
        carrierId: options.carrierId,
        departureId: options.departureId,
      },
    });
  }

  if (!hasReturn) {
    const departureTime = combineUtcDateTime(
      options.date,
      options.last.returnDay,
      options.last.returnTime
    );
    let arrivalTime = combineUtcDateTime(
      options.date,
      options.first.returnDay,
      options.first.returnTime
    );
    if (arrivalTime <= departureTime) {
      arrivalTime = new Date(departureTime.getTime() + 12 * 60 * 60 * 1000);
    }
    await prisma.trip.create({
      data: {
        fromCity: options.destinationCity,
        toCity: options.originCity,
        departureTime,
        arrivalTime,
        price: 99,
        carrierId: options.carrierId,
        departureId: options.departureId,
      },
    });
  }
}
