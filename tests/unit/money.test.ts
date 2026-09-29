import { describe, expect, it } from "vitest";
import { agentReward, debtSide, netPaid, reconcile, signedBalance } from "@/lib/finance/money";
import { isStatusTransitionAllowed } from "@/lib/tickets/labels";
import { moneyState, priceBreakdown } from "@/lib/tickets/ticketMoney";

describe("reconciliation money helpers", () => {
  it("signs settlement balances: plus = we owe the carrier, minus = it owes us", () => {
    expect(signedBalance("TO_CARRIER", 85)).toBe(85);
    expect(signedBalance("TO_AGENT", 6.6)).toBe(-6.6);
    expect(signedBalance("ZERO", 0)).toBe(0);
  });

  it("nets payments: outgoing minus incoming", () => {
    expect(netPaid([])).toBe(0);
    expect(
      netPaid([
        { direction: "OUTGOING", amount: 50 },
        { direction: "INCOMING", amount: 6.6 },
        { direction: "OUTGOING", amount: 0.1 },
      ])
    ).toBe(43.5);
  });

  it("debt = accrued − paid, with the side", () => {
    expect(reconcile(85, 50)).toEqual({ accrued: 85, paid: 50, debt: 35, side: "WE_OWE" });
    expect(reconcile(-6.6, 0)).toMatchObject({ debt: -6.6, side: "THEY_OWE" });
    expect(reconcile(25.4, 25.4)).toMatchObject({ debt: 0, side: "SETTLED" });
    // Float noise never shows up as a one-cent debt.
    expect(reconcile(0.1 + 0.2, 0.3).side).toBe("SETTLED");
    expect(debtSide(0.004)).toBe("SETTLED");
  });

  it("agent reward: % of the ticket price, nothing without a %", () => {
    expect(agentReward(40, 5)).toBe(2);
    expect(agentReward(94.05, 5)).toBe(4.7);
    expect(agentReward(40, null)).toBe(0);
    expect(agentReward(40, 0)).toBe(0);
  });
});

describe("ticket price block", () => {
  const payment = {
    status: "SETTLED",
    amount: 94.05,
    fullAmount: 99,
    provider: "MONOBANK",
    providerRef: "INV-777",
    sentAt: new Date("2026-09-29T09:40:00Z"),
    deadlineAt: new Date("2026-09-30T09:00:00Z"),
  };

  it("lists only the discounts actually applied", () => {
    expect(
      priceBreakdown({ basePrice: 100, finalPrice: 100, ageCategory: "ADULT", promoCode: null, onlinePayment: null })
    ).toEqual({ base: 100, discounts: [], total: 100 });
    const b = priceBreakdown({ basePrice: 110, finalPrice: 94.05, ageCategory: "ADULT", promoCode: "DISCOUNT10", onlinePayment: payment });
    expect(b.discounts).toEqual([
      { label: "Промокод DISCOUNT10", amount: 11 },
      { label: "Онлайн-оплата", amount: 4.95 },
    ]);
  });

  it("paid online: green, with the payment-system transaction", () => {
    const m = moneyState({ status: "PAID_ONLINE", finalPrice: 94.05, payment, cashCollector: null, cashCollectedAt: null, statusSince: null });
    expect(m).toMatchObject({ tone: "paid", label: "Оплачено онлайн", amount: 94.05 });
    expect(m.note).toContain("monobank");
    expect(m.note).toContain("транзакція INV-777");
  });

  it("paid cash: green, with who took the money and when", () => {
    const at = new Date("2026-09-29T10:00:00Z");
    expect(moneyState({ status: "PAID_CASH", finalPrice: 60, payment: null, cashCollector: "Агент (agent@x)", cashCollectedAt: at, statusSince: at }).note).toMatch(
      /^Готівкою отримав Агент \(agent@x\) · 29\.09\.2026/
    );
    expect(moneyState({ status: "PAID_CASH", finalPrice: 60, payment: null, cashCollector: null, cashCollectedAt: null, statusSince: at }).note).toMatch(
      /^Готівкою водію в автобусі/
    );
  });

  it("unpaid: amber «До оплати»; awaiting shows the cancellation deadline", () => {
    expect(moneyState({ status: "RESERVED", finalPrice: 99, payment: null, cashCollector: null, cashCollectedAt: null, statusSince: null }).tone).toBe("due");
    const m = moneyState({ status: "AWAITING_PAYMENT", finalPrice: 94.05, payment: { ...payment, status: "PENDING" }, cashCollector: null, cashCollectedAt: null, statusSince: null });
    expect(m).toMatchObject({ tone: "due", label: "До оплати" });
    expect(m.note).toMatch(/інакше бронювання скасується/);
  });

  it("a paid ticket is refunded, never cancelled", () => {
    expect(isStatusTransitionAllowed("PAID_CASH", "CANCELLED")).toBe(false);
    expect(isStatusTransitionAllowed("PAID_ONLINE", "REFUNDED")).toBe(true);
    expect(isStatusTransitionAllowed("AWAITING_PAYMENT", "PAID_CASH")).toBe(true);
  });
});
