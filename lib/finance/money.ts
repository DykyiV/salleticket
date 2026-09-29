/**
 * Sign convention for counterparty reconciliation (carriers and agents):
 *
 *   positive  →  in the counterparty's favour: WE owe THEM
 *   negative  →  in our favour: THEY owe US
 *
 * Accrued amounts come from settlement balances (carriers) or sales-agent
 * rewards (agents); paid amounts from recorded CounterpartyPayments, where
 * OUTGOING (we paid them) is positive and INCOMING (they paid us) negative.
 * The open balance is simply accrued − paid.
 */

export type Direction = "OUTGOING" | "INCOMING";
export type DebtSide = "WE_OWE" | "THEY_OWE" | "SETTLED";

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Settlement balance as a signed amount (see the convention above). */
export function signedBalance(balanceDirection: string, balanceAmount: number): number {
  if (balanceDirection === "TO_CARRIER") return round2(balanceAmount);
  if (balanceDirection === "TO_AGENT") return round2(-balanceAmount);
  return 0;
}

/** Net money transferred: OUTGOING minus INCOMING. */
export function netPaid(payments: { direction: Direction | string; amount: number }[]): number {
  return round2(
    payments.reduce(
      (sum, p) => sum + (p.direction === "INCOMING" ? -p.amount : p.amount),
      0
    )
  );
}

export function debtSide(debt: number): DebtSide {
  if (debt >= 0.005) return "WE_OWE";
  if (debt <= -0.005) return "THEY_OWE";
  return "SETTLED";
}

export type Reconciled = {
  accrued: number;
  paid: number;
  debt: number;
  side: DebtSide;
};

export function reconcile(accrued: number, paid: number): Reconciled {
  const debt = round2(accrued - paid);
  return { accrued: round2(accrued), paid: round2(paid), debt, side: debtSide(debt) };
}

/** Sales-agent reward for one paid ticket. */
export function agentReward(finalPrice: number, percent: number | null | undefined): number {
  if (percent == null || !Number.isFinite(percent) || percent <= 0) return 0;
  return round2((finalPrice * percent) / 100);
}
