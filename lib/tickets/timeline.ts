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
};

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
  if (typeof value === "object") return JSON.stringify(value);
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
