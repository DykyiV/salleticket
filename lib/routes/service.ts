import type { Prisma, PrismaClient } from "@prisma/client";

/** A stop as sent by the admin route constructor UI. */
export type StopInput = {
  city?: unknown;
  address?: unknown;
  offsetMinutes?: unknown;
  isPickup?: unknown;
  isDropoff?: unknown;
};

export type RoutePayload = {
  name?: unknown;
  fromCity?: unknown;
  toCity?: unknown;
  /** Existing carrier id. Takes precedence over carrierName. */
  carrierId?: unknown;
  /** Convenience for the admin UI: find-or-create a carrier by name. */
  carrierName?: unknown;
  departureTime?: unknown;
  /** Array of ISO weekday numbers (1=Mon..7=Sun), or a "1,2,3" string. */
  daysOfWeek?: unknown;
  basePrice?: unknown;
  busCapacity?: unknown;
  busType?: unknown;
  /** Array of amenity labels, or a comma-separated string. */
  amenities?: unknown;
  isActive?: unknown;
  stops?: unknown;
};

export class RouteValidationError extends Error {}

function requireString(input: unknown, field: string): string {
  if (typeof input !== "string" || !input.trim()) {
    throw new RouteValidationError(`${field} is required`);
  }
  return input.trim();
}

function parseTime(input: unknown, field: string): string {
  const s = requireString(input, field);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) {
    throw new RouteValidationError(`${field} must be in HH:MM 24h format`);
  }
  return s;
}

function parseDaysOfWeek(input: unknown): string {
  const arr = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(",")
      : null;
  if (!arr) {
    throw new RouteValidationError(
      "daysOfWeek must be an array of weekday numbers (1=Mon..7=Sun)"
    );
  }
  const days = arr
    .map((v) => (typeof v === "number" ? v : Number.parseInt(String(v).trim(), 10)))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
  if (days.length === 0) {
    throw new RouteValidationError("daysOfWeek must include at least one weekday");
  }
  return Array.from(new Set(days)).sort().join(",");
}

function parsePositiveNumber(input: unknown, field: string): number {
  const n = typeof input === "number" ? input : Number.parseFloat(String(input));
  if (!Number.isFinite(n) || n <= 0) {
    throw new RouteValidationError(`${field} must be a positive number`);
  }
  return n;
}

function parsePositiveInt(input: unknown, field: string): number {
  const n = typeof input === "number" ? input : Number.parseInt(String(input), 10);
  if (!Number.isInteger(n) || n <= 0) {
    throw new RouteValidationError(`${field} must be a positive integer`);
  }
  return n;
}

function parseAmenities(input: unknown): string {
  if (input === undefined) return "";
  const arr = Array.isArray(input) ? input : String(input).split(",");
  return arr
    .map((a) => String(a).trim())
    .filter(Boolean)
    .join(",");
}

function parseStops(input: unknown): {
  order: number;
  city: string;
  address: string | null;
  offsetMinutes: number;
  isPickup: boolean;
  isDropoff: boolean;
}[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new RouteValidationError("At least one stop is required");
  }
  return (input as StopInput[]).map((raw, index) => {
    const city = requireString(raw.city, `stops[${index}].city`);
    const offsetMinutes =
      raw.offsetMinutes === undefined
        ? 0
        : (() => {
            const n =
              typeof raw.offsetMinutes === "number"
                ? raw.offsetMinutes
                : Number.parseInt(String(raw.offsetMinutes), 10);
            if (!Number.isFinite(n) || n < 0) {
              throw new RouteValidationError(
                `stops[${index}].offsetMinutes must be a non-negative integer`
              );
            }
            return Math.floor(n);
          })();
    return {
      order: index,
      city,
      address:
        raw.address === undefined || raw.address === null || raw.address === ""
          ? null
          : String(raw.address).trim(),
      offsetMinutes,
      isPickup: raw.isPickup === undefined ? true : Boolean(raw.isPickup),
      isDropoff: raw.isDropoff === undefined ? true : Boolean(raw.isDropoff),
    };
  });
}

async function resolveCarrierId(
  db: Pick<PrismaClient, "carrier">,
  payload: RoutePayload
): Promise<string> {
  if (typeof payload.carrierId === "string" && payload.carrierId.trim()) {
    const carrier = await db.carrier.findUnique({
      where: { id: payload.carrierId },
    });
    if (!carrier) throw new RouteValidationError("Unknown carrierId");
    return carrier.id;
  }
  const name = requireString(payload.carrierName, "carrierName or carrierId");
  const carrier = await db.carrier.upsert({
    where: { name },
    update: {},
    create: { name, rating: 4.5 },
  });
  return carrier.id;
}

/** Normalised create input, including the ordered stop rows to create alongside it. */
export async function parseCreateRoute(
  db: Pick<PrismaClient, "carrier">,
  payload: RoutePayload
): Promise<{
  data: Prisma.RouteCreateInput;
  stops: ReturnType<typeof parseStops>;
}> {
  const name = requireString(payload.name, "name");
  const fromCity = requireString(payload.fromCity, "fromCity");
  const toCity = requireString(payload.toCity, "toCity");
  const carrierId = await resolveCarrierId(db, payload);
  const departureTime = parseTime(payload.departureTime, "departureTime");
  const daysOfWeek = parseDaysOfWeek(payload.daysOfWeek);
  const basePrice = parsePositiveNumber(payload.basePrice, "basePrice");
  const busCapacity = parsePositiveInt(payload.busCapacity ?? 45, "busCapacity");
  const busType =
    payload.busType === undefined || payload.busType === null
      ? "Autobus"
      : requireString(payload.busType, "busType");
  const amenities = parseAmenities(payload.amenities);
  const isActive = payload.isActive === undefined ? true : Boolean(payload.isActive);
  const stops = parseStops(payload.stops);

  return {
    data: {
      name,
      fromCity,
      toCity,
      carrier: { connect: { id: carrierId } },
      departureTime,
      daysOfWeek,
      basePrice,
      busCapacity,
      busType,
      amenities,
      isActive,
    },
    stops,
  };
}

/** Normalised update input. Only fields explicitly present in the payload are touched. */
export async function parseUpdateRoute(
  db: Pick<PrismaClient, "carrier">,
  payload: RoutePayload
): Promise<{
  data: Prisma.RouteUpdateInput;
  stops: ReturnType<typeof parseStops> | undefined;
}> {
  const data: Prisma.RouteUpdateInput = {};

  if (payload.name !== undefined) data.name = requireString(payload.name, "name");
  if (payload.fromCity !== undefined) data.fromCity = requireString(payload.fromCity, "fromCity");
  if (payload.toCity !== undefined) data.toCity = requireString(payload.toCity, "toCity");
  if (payload.carrierId !== undefined || payload.carrierName !== undefined) {
    data.carrier = { connect: { id: await resolveCarrierId(db, payload) } };
  }
  if (payload.departureTime !== undefined) {
    data.departureTime = parseTime(payload.departureTime, "departureTime");
  }
  if (payload.daysOfWeek !== undefined) {
    data.daysOfWeek = parseDaysOfWeek(payload.daysOfWeek);
  }
  if (payload.basePrice !== undefined) {
    data.basePrice = parsePositiveNumber(payload.basePrice, "basePrice");
  }
  if (payload.busCapacity !== undefined) {
    data.busCapacity = parsePositiveInt(payload.busCapacity, "busCapacity");
  }
  if (payload.busType !== undefined) {
    data.busType = requireString(payload.busType, "busType");
  }
  if (payload.amenities !== undefined) {
    data.amenities = parseAmenities(payload.amenities);
  }
  if (payload.isActive !== undefined) {
    data.isActive = Boolean(payload.isActive);
  }

  const stops = payload.stops !== undefined ? parseStops(payload.stops) : undefined;

  return { data, stops };
}
