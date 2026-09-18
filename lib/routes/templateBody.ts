import {
  parseOptionalText,
  parseRequiredText,
  parseStops,
  RouteValidationError,
  type StopInput,
} from "@/lib/routes/validate";
import { stringifyWeekdays } from "@/lib/routes/weekdays";

function parseWeekdayList(raw: unknown): number[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new RouteValidationError("Оберіть хоча б один день виїзду");
  }
  const days = raw
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
  if (!days.length) {
    throw new RouteValidationError("Оберіть хоча б один день виїзду");
  }
  return [...new Set(days)].sort((a, b) => a - b);
}

function parseOptionalWeekday(raw: unknown, label: string): number | null {
  if (raw == null || raw === "") return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 7) {
    throw new RouteValidationError(`${label}: оберіть день тижня`);
  }
  return value;
}

export type ParsedTemplateBody = {
  countryId: string;
  originCountryId: string | null;
  name: string;
  originCity: string;
  destinationCity: string;
  departureWeekdays: string;
  busPhone: string | null;
  dispatcherPhone: string | null;
  ukraineDepartureWeekday: number | null;
  ukraineReturnWeekday: number | null;
  defaultBus: string | null;
  comment: string | null;
  hasAssignedSeats: boolean;
  isActive: boolean;
  stops: StopInput[];
};

export function parseTemplateBody(body: Record<string, unknown>): ParsedTemplateBody {
  const originCity = parseRequiredText(body.originCity, "Початковий пункт");
  const destinationCity = parseRequiredText(
    body.destinationCity,
    "Кінцевий пункт"
  );
  const name =
    parseOptionalText(body.name) ?? `${originCity} — ${destinationCity}`;
  const countryId = parseRequiredText(body.countryId, "Країна прибуття");
  const originCountryId = parseOptionalText(body.originCountryId);
  const departureWeekdays = parseWeekdayList(body.departureWeekdays);
  const stops = parseStops(body.stops);
  return {
    countryId,
    originCountryId,
    name,
    originCity,
    destinationCity,
    departureWeekdays: stringifyWeekdays(departureWeekdays),
    busPhone: parseOptionalText(body.busPhone),
    dispatcherPhone: parseOptionalText(body.dispatcherPhone),
    ukraineDepartureWeekday: parseOptionalWeekday(
      body.ukraineDepartureWeekday,
      "День виїзду з України"
    ),
    ukraineReturnWeekday: parseOptionalWeekday(
      body.ukraineReturnWeekday,
      "День повернення в Україну"
    ),
    defaultBus: parseOptionalText(body.defaultBus),
    comment: parseOptionalText(body.comment),
    hasAssignedSeats: body.hasAssignedSeats !== false,
    isActive: body.isActive !== false,
    stops,
  };
}
