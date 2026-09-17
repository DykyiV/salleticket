export class RouteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RouteValidationError";
  }
}

export function parseTime(raw: unknown, label: string): string {
  const value = String(raw ?? "").trim();
  const hm = /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? value
    : /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value)
      ? value.slice(0, 5)
      : "";
  if (!hm) {
    throw new RouteValidationError(`${label}: вкажіть час у форматі ГГ:ХХ`);
  }
  return hm;
}

export function parseRouteDay(raw: unknown, label: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 14) {
    throw new RouteValidationError(`${label}: день маршруту має бути від 1 до 14`);
  }
  return value;
}

export function parseOptionalFloat(
  raw: unknown,
  label: string
): number | null {
  if (raw == null || raw === "") return null;
  const value = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(value)) {
    throw new RouteValidationError(`${label}: некоректне число`);
  }
  return value;
}

export function parseOptionalText(raw: unknown): string | null {
  const value = String(raw ?? "").trim();
  return value ? value : null;
}

export function parseRequiredText(raw: unknown, label: string): string {
  const value = String(raw ?? "").trim();
  if (!value) {
    throw new RouteValidationError(`${label} є обовʼязковим`);
  }
  return value;
}

export type StopInput = {
  id?: string;
  sortOrder: number;
  city: string;
  outboundDay: number;
  outboundTime: string;
  returnDay: number;
  returnTime: string;
  addressLabel: string | null;
  boardingAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  visibleByDefault: boolean;
};

export function parseStopInput(raw: unknown, index: number): StopInput {
  const row = (raw ?? {}) as Record<string, unknown>;
  const city = parseRequiredText(row.city, `Місто #${index + 1}`);
  const sortOrder = Number(row.sortOrder ?? index + 1);
  if (!Number.isInteger(sortOrder) || sortOrder < 1) {
    throw new RouteValidationError(`Порядковий номер для ${city} має бути ≥ 1`);
  }
  const latitude = parseOptionalFloat(row.latitude, `Широта (${city})`);
  const longitude = parseOptionalFloat(row.longitude, `Довгота (${city})`);
  if ((latitude == null) !== (longitude == null)) {
    throw new RouteValidationError(
      `${city}: широта і довгота мають бути обидві, або обидві порожні`
    );
  }
  return {
    id: typeof row.id === "string" ? row.id : undefined,
    sortOrder,
    city,
    outboundDay: parseRouteDay(row.outboundDay, `День відправлення (${city})`),
    outboundTime: parseTime(row.outboundTime, `Час відправлення (${city})`),
    returnDay: parseRouteDay(row.returnDay, `День повернення (${city})`),
    returnTime: parseTime(row.returnTime, `Час повернення (${city})`),
    addressLabel: parseOptionalText(row.addressLabel),
    boardingAddress: parseOptionalText(row.boardingAddress),
    latitude,
    longitude,
    visibleByDefault: Boolean(row.visibleByDefault ?? true),
  };
}

export function parseStops(raw: unknown): StopInput[] {
  if (!Array.isArray(raw) || raw.length < 2) {
    throw new RouteValidationError("Додайте щонайменше два міста: початок і кінець");
  }
  const stops = raw.map((row, i) => parseStopInput(row, i));
  const orders = stops.map((s) => s.sortOrder);
  if (new Set(orders).size !== orders.length) {
    throw new RouteValidationError("Порядкові номери міст мають бути унікальні");
  }
  return stops.sort((a, b) => a.sortOrder - b.sortOrder);
}
