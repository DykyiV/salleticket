import { prisma } from "@/lib/db";
import { parseTime, RouteValidationError } from "@/lib/routes/validate";
import {
  stopMatchesFilter,
  type BulkAction,
  type BulkPayload,
} from "@/lib/routes/bulk";

const ACTIONS: BulkAction[] = [
  "hideStops",
  "showStops",
  "setSaleEnabled",
  "setStopTime",
];

export async function applyDepartureBulk(
  payload: BulkPayload
): Promise<{ updatedDepartures: number; updatedStops: number }> {
  const ids = (payload.departureIds ?? []).filter(Boolean);
  if (!ids.length) {
    throw new RouteValidationError("Оберіть хоча б один виїзд");
  }
  if (!ACTIONS.includes(payload.action)) {
    throw new RouteValidationError("Невідома дія");
  }
  if (
    !payload.city &&
    payload.sortFrom == null &&
    payload.sortTo == null
  ) {
    throw new RouteValidationError("Вкажіть місто або діапазон порядкових номерів");
  }

  const departures = await prisma.departure.findMany({
    where: { id: { in: ids } },
    include: { stops: true },
  });
  if (!departures.length) {
    throw new RouteValidationError("Виїзди не знайдено");
  }

  let updatedStops = 0;
  for (const departure of departures) {
    const matches = departure.stops.filter((stop) =>
      stopMatchesFilter(stop, payload)
    );
    for (const stop of matches) {
      if (payload.action === "hideStops") {
        await prisma.departureStop.update({
          where: { id: stop.id },
          data: { isVisible: false },
        });
        updatedStops += 1;
      } else if (payload.action === "showStops") {
        await prisma.departureStop.update({
          where: { id: stop.id },
          data: { isVisible: true },
        });
        updatedStops += 1;
      } else if (payload.action === "setSaleEnabled") {
        await prisma.departureStop.update({
          where: { id: stop.id },
          data: { saleEnabled: Boolean(payload.saleEnabled) },
        });
        updatedStops += 1;
      } else if (payload.action === "setStopTime") {
        const data: { outboundTime?: string; returnTime?: string } = {};
        if (payload.outboundTime) {
          data.outboundTime = parseTime(payload.outboundTime, "Час відправлення");
        }
        if (payload.returnTime) {
          data.returnTime = parseTime(payload.returnTime, "Час повернення");
        }
        if (!data.outboundTime && !data.returnTime) {
          throw new RouteValidationError(
            "Вкажіть новий час відправлення або повернення"
          );
        }
        await prisma.departureStop.update({
          where: { id: stop.id },
          data,
        });
        updatedStops += 1;
      }
    }
  }

  return { updatedDepartures: departures.length, updatedStops };
}
