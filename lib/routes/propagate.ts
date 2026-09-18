import { prisma } from "@/lib/db";
import { stopCreateData } from "@/lib/routes/serialize";

export async function propagateTemplateToDepartures(options: {
  templateId: string;
  from: Date;
  to: Date;
}): Promise<{ updated: number }> {
  const template = await prisma.routeTemplate.findUnique({
    where: { id: options.templateId },
    include: { stops: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) {
    throw new Error("Шаблон маршруту не знайдено");
  }

  const departures = await prisma.departure.findMany({
    where: {
      templateId: template.id,
      date: { gte: options.from, lte: options.to },
    },
    include: { stops: true },
  });

  const keepIds = new Set(template.stops.map((s) => s.id));

  for (const departure of departures) {
    await prisma.$transaction(async (tx) => {
      await tx.departure.update({
        where: { id: departure.id },
        data: {
          busPhone: template.busPhone,
          dispatcherPhone: template.dispatcherPhone,
          defaultBus: template.defaultBus,
          comment: template.comment,
          ukraineDepartureWeekday: template.ukraineDepartureWeekday,
          ukraineReturnWeekday: template.ukraineReturnWeekday,
          hasAssignedSeats: template.hasAssignedSeats,
        },
      });

      for (const stop of departure.stops) {
        if (stop.templateStopId && !keepIds.has(stop.templateStopId)) {
          await tx.departureStop.delete({ where: { id: stop.id } });
        }
      }

      for (const templateStop of template.stops) {
        const existing = departure.stops.find(
          (s) => s.templateStopId === templateStop.id
        );
        const payload = {
          templateStopId: templateStop.id,
          ...stopCreateData(templateStop),
          isVisible: templateStop.visibleByDefault,
        };
        if (existing) {
          await tx.departureStop.update({
            where: { id: existing.id },
            data: payload,
          });
        } else {
          await tx.departureStop.create({
            data: {
              departureId: departure.id,
              ...payload,
              saleEnabled: true,
            },
          });
        }
      }
    });
  }

  return { updated: departures.length };
}
