import type { TicketStatus } from "@prisma/client";

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  RESERVED: "Зарезервовано",
  PAID_ONLINE: "Оплачено онлайн",
  PAID_CASH: "Оплачено готівкою",
  CANCELLED: "Скасовано",
  REFUNDED: "Повернено",
};

export const TICKET_STATUS_CLASS: Record<TicketStatus, string> = {
  RESERVED: "bg-amber-50 text-amber-800 ring-amber-200",
  PAID_ONLINE: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  PAID_CASH: "bg-sky-50 text-sky-800 ring-sky-200",
  CANCELLED: "bg-rose-50 text-rose-800 ring-rose-200",
  REFUNDED: "bg-slate-100 text-slate-600 ring-slate-200",
};

export const AGE_LABEL: Record<string, string> = {
  CHILD_0_4: "Дитина 0–4",
  CHILD_5_12: "Дитина 5–12",
  ADULT: "Дорослий",
  SENIOR_60: "60+",
};

export const HISTORY_ACTION_LABEL: Record<string, string> = {
  CREATED: "Створено",
  PASSENGER_UPDATED: "Змінено пасажира",
  STATUS_CHANGE: "Змінено статус",
  STATUS_CONFIRMED: "Підтверджено статус",
  CANCELLED_BY_OWNER: "Скасовано пасажиром",
};

export const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  RESERVED: ["PAID_ONLINE", "PAID_CASH", "CANCELLED"],
  PAID_ONLINE: ["REFUNDED", "CANCELLED"],
  PAID_CASH: ["REFUNDED", "CANCELLED"],
  CANCELLED: [],
  REFUNDED: [],
};

export const STATUS_ACTION_LABEL: Record<TicketStatus, string> = {
  RESERVED: "Повернути в резерв",
  PAID_ONLINE: "Позначити оплаченим онлайн",
  PAID_CASH: "Позначити оплаченим готівкою",
  CANCELLED: "Скасувати квиток",
  REFUNDED: "Повернути кошти",
};

export const STATUS_ACTION_CLASS: Record<TicketStatus, string> = {
  RESERVED: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
  PAID_ONLINE: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
  PAID_CASH: "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100",
  REFUNDED: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
};

export function isStatusTransitionAllowed(
  from: TicketStatus,
  to: TicketStatus
): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

export function eur(n: number): string {
  return `€${n.toFixed(2)}`;
}

/** Amount actually collected. Reserved / cancelled / refunded tickets are unpaid. */
export function paidAmount(status: TicketStatus, finalPrice: number): number {
  if (status === "PAID_ONLINE" || status === "PAID_CASH") return finalPrice;
  return 0;
}

export function bookedByLabel(user: {
  displayName?: string | null;
  email: string;
}): string {
  const name = user.displayName?.trim();
  return name || user.email;
}
