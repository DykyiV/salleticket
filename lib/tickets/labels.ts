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

export function eur(n: number): string {
  return `€${n.toFixed(2)}`;
}
