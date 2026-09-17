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

  for (const date of dates) {
    const existing = await prisma.departure.findUnique({
      where: {
        templateId_date: { templateId: template.id, date },
      },
    });
    if (existing) {
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

    const first = template.stops[0];
    const last = template.stops[template.stops.length - 1];
    const carrier = await prisma.carrier.upsert({
      where: { name: "Asol BUS" },
      create: { name: "Asol BUS", rating: 4.8 },
      update: {},
    });
    await prisma.trip.create({
      data: {
        fromCity: template.originCity,
        toCity: template.destinationCity,
        departureTime: combineUtcDateTime(
          date,
          first.outboundDay,
          first.outboundTime
        ),
        arrivalTime: combineUtcDateTime(
          date,
          last.outboundDay,
          last.outboundTime
        ),
        price: 99,
        carrierId: carrier.id,
        departureId: createdDeparture.id,
      },
    });
    created += 1;
    createdDates.push(date.toISOString().slice(0, 10));
  }

  return { created, skipped, dates: createdDates };
}
