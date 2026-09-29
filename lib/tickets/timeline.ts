import { eur, TICKET_STATUS_LABEL, TRIP_KIND_LABEL } from "@/lib/tickets/labels";

/**
 * Booking timeline: turns TicketHistory rows into human entries with the
 * actor name and readable field diffs («було → стало»).
 */
export type TimelineRow = {
  id: string;
  timestamp: Date;
  action: string;
  changes: string | null;
  changedBy: string | null;
  source: string | null;
};

export type TimelineEntry = {
  id: string;
  time: string;
  actor: string;
  action: string;
  lines: string[];
};

const FIELD_LABEL: Record<string, string> = {
  status: "Статус",
  finalPrice: "Ціна",
  basePrice: "Базова ціна",
  seatNumber: "Місце",
  returnSeatNumber: "Місце назад",
  tripId: "Рейс",
  returnTripId: "Зворотній рейс",
  tripKind: "Тип квитка",
  promoCode: "Промокод",
  paymentMethod: "Спосіб оплати",
  reference: "Номер квитка",
  amount: "Сума оплати",
  deadlineAt: "Дедлайн оплати",
  payment: "Платіж",
  paymentStatus: "Статус платежу",
  providerRef: "Платіжний референс",
  passenger: "Пасажир",
  trip: "Рейс",
  firstName: "Імʼя",
  lastName: "Прізвище",
  phone: "Телефон",
  email: "Email",
  ageCategory: "Вікова категорія",
  tariff: "Тариф",
  commission: "Комісія",
  cashCollector: "Готівку отримав",
  sms: "SMS",
};

type Obj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === "number" ? v : null);

/** Readable one-liners for the structured snapshots written at booking time. */
function formatObject(field: string, o: Obj): string | null {
  if (field === "passenger") {
    const name = [str(o.firstName), str(o.lastName)].filter(Boolean).join(" ");
    return [name || null, str(o.phone), str(o.email)].filter(Boolean).join(" · ") || null;
  }
  if (field === "trip") {
    const route = str(o.from) && str(o.to) ? `${o.from} → ${o.to}` : null;
    const when = str(o.departure);
    const date = when && !Number.isNaN(Date.parse(when))
      ? new Date(when).toISOString().slice(0, 16).replace("T", " ")
      : when;
    return [route, date, str(o.carrier)].filter(Boolean).join(" · ") || null;
  }
  if (field === "commission") {
    const pct = num(o.percent);
    const agency = num(o.agencyAmount) ?? num(o.commissionAmount);
    const carrier = num(o.carrierAmount);
    if (pct == null) return null;
    const parts = [`${pct}%`];
    if (agency != null) parts.push(`агенції ${eur(agency)}`);
    if (carrier != null) parts.push(`перевізнику ${eur(carrier)}`);
    return parts.join(" · ");
  }
  return null;
}

const PRICE_FIELDS = new Set(["finalPrice", "basePrice", "amount"]);

function formatValue(field: string, value: unknown): string {
  if (value == null) return "—";
  if (PRICE_FIELDS.has(field) && typeof value === "number") return eur(value);
  if (field === "status" && typeof value === "string") {
    return TICKET_STATUS_LABEL[value as never] ?? value;
  }
  if (field === "tripKind" && typeof value === "string") {
    return TRIP_KIND_LABEL[value] ?? value;
  }
  if (field === "paymentMethod") {
    return value === "ONLINE" ? "Онлайн" : "В автобусі";
  }
  if (typeof value === "object") {
    return formatObject(field, value as Obj) ?? JSON.stringify(value);
  }
  return String(value);
}

export function timelineLines(changes: string | null): string[] {
  if (!changes) return [];
  try {
    const parsed = JSON.parse(changes) as Record<
      string,
      { from: unknown; to: unknown }
    >;
    return Object.entries(parsed).map(([field, diff]) => {
      const label = FIELD_LABEL[field] ?? field;
      if (diff.from == null) return `${label}: ${formatValue(field, diff.to)}`;
      return `${label}: було ${formatValue(field, diff.from)} → стало ${formatValue(field, diff.to)}`;
    });
  } catch {
    return [];
  }
}

export function buildTimeline(
  rows: TimelineRow[],
  actorNames: Map<string, string>,
  actionLabel: (action: string) => string
): TimelineEntry[] {
  return rows.map((row) => ({
    id: row.id,
    time: row.timestamp.toLocaleString("uk-UA", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
    actor: row.changedBy
      ? (actorNames.get(row.changedBy) ?? "Користувач")
      : "Система",
    action: actionLabel(row.action),
    lines: timelineLines(row.changes),
  }));
}
