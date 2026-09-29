import { describe, expect, it } from "vitest";
import { agentReward, debtSide, netPaid, reconcile, signedBalance } from "@/lib/finance/money";

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
