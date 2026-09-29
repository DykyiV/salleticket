import type { TicketStatus } from "@prisma/client";
import { applyAgeDiscount, type AgeCategoryId } from "@/lib/pricing";
import { AGE_LABEL, eur } from "@/lib/tickets/labels";

/**
 * What the price block of a ticket shows: the breakdown (base price and
 * every discount actually applied) and the money state — how much is still
 * to pay (amber) or was paid (green), with a light note saying how: the
 * payment-system transaction or who took the cash and when.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

export type PriceLine = { label: string; amount: number };

export type PaymentInfo = {
  status: string;
  amount: number;
  fullAmount: number;
  provider: string;
  providerRef: string | null;
  sentAt: Date | null;
  deadlineAt: Date;
};

export function priceBreakdown(input: {
  basePrice: number;
  finalPrice: number;
  ageCategory: string;
  promoCode: string | null;
  /** Latest payment, when the online discount applies (pending / paid). */
  onlinePayment: PaymentInfo | null;
}): { base: number; discounts: PriceLine[]; total: number } {
  const discounts: PriceLine[] = [];
  const online =
    input.onlinePayment && input.onlinePayment.fullAmount > input.onlinePayment.amount
      ? round2(input.onlinePayment.fullAmount - input.onlinePayment.amount)
      : 0;
  const beforeOnline = round2(input.finalPrice + online);

  const age = applyAgeDiscount(input.basePrice, input.ageCategory as AgeCategoryId).discount;
  if (age > 0.004) {
    discounts.push({ label: `Знижка: ${AGE_LABEL[input.ageCategory] ?? input.ageCategory}`, amount: round2(age) });
  }
  // Whatever else lies between the base and the pre-online price: promo code
  // or another discount (never shown when the difference is a surcharge).
  const rest = round2(input.basePrice - age - beforeOnline);
  if (rest > 0.004) {
    discounts.push({ label: input.promoCode ? `Промокод ${input.promoCode}` : "Знижка", amount: rest });
  }
  if (online > 0) discounts.push({ label: "Онлайн-оплата", amount: online });

  return { base: round2(input.basePrice), discounts, total: round2(input.finalPrice) };
}

export type MoneyTone = "due" | "paid" | "void";

export type MoneyState = {
  tone: MoneyTone;
  /** "До оплати" / "Оплачено" / … */
  label: string;
  amount: number;
  /** Light text under the amount: transaction, cash holder, deadline. */
  note: string | null;
};

const PROVIDER_LABEL: Record<string, string> = {
  MOCK: "Тестова платіжна система",
  MONOBANK: "monobank",
  LIQPAY: "LiqPay",
  STRIPE: "Stripe",
};

const when = (d: Date | null | undefined) =>
  d ? d.toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kyiv" }) : null;

export function moneyState(input: {
  status: TicketStatus;
  finalPrice: number;
  payment: PaymentInfo | null;
  /** PAID_CASH: who took the cash (null = the driver) and when. */
  cashCollector: string | null;
  cashCollectedAt: Date | null;
  /** When the ticket got its current status (from the history). */
  statusSince: Date | null;
}): MoneyState {
  const { status, finalPrice: amount, payment } = input;
  switch (status) {
    case "PAID_ONLINE": {
      const provider = payment ? PROVIDER_LABEL[payment.provider] ?? payment.provider : null;
      const note = payment
        ? [provider, payment.providerRef ? `транзакція ${payment.providerRef}` : null, when(payment.sentAt ?? input.statusSince)]
            .filter(Boolean)
            .join(" · ")
        : ["Позначено оплаченим онлайн вручну", when(input.statusSince)].filter(Boolean).join(" · ");
      return { tone: "paid", label: "Оплачено онлайн", amount, note };
    }
    case "PAID_CASH": {
      const at = when(input.cashCollectedAt ?? input.statusSince);
      const who = input.cashCollector ? `отримав ${input.cashCollector}` : "водію в автобусі";
      return { tone: "paid", label: "Оплачено готівкою", amount, note: [`Готівкою ${who}`, at].filter(Boolean).join(" · ") };
    }
    case "AWAITING_PAYMENT": {
      if (payment?.status === "SENT") {
        return {
          tone: "due",
          label: "До оплати",
          amount,
          note: `Оплату надіслано ${when(payment.sentAt) ?? ""} — чекаємо зарахування коштів`.trim(),
        };
      }
      return {
        tone: "due",
        label: "До оплати",
        amount,
        note: payment
          ? `Сплатіть онлайн до ${when(payment.deadlineAt)}, інакше бронювання скасується`
          : "Очікуємо онлайн-оплату",
      };
    }
    case "RESERVED":
      return { tone: "due", label: "До оплати", amount, note: "Оплата водію при посадці, готівкою в касі або онлайн" };
    case "CANCELLED":
      return { tone: "void", label: "Бронювання скасовано", amount, note: when(input.statusSince) };
    case "REFUNDED":
      return { tone: "void", label: "Кошти повернено", amount, note: when(input.statusSince) };
  }
}

export const MONEY_TONE_CLASS: Record<MoneyTone, string> = {
  due: "bg-amber-50 ring-amber-200 text-amber-900",
  paid: "bg-emerald-50 ring-emerald-200 text-emerald-900",
  void: "bg-slate-50 ring-slate-200 text-slate-600",
};

export { eur };
