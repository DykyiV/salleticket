import type { DebtSide } from "@/lib/finance/money";

/** Who owes whom, from our side of the table. */
export const SIDE_LABEL: Record<DebtSide, string> = {
  WE_OWE: "Ми винні",
  THEY_OWE: "Нам винні",
  SETTLED: "Розраховано",
};

export const SIDE_CLASS: Record<DebtSide, string> = {
  WE_OWE: "bg-amber-50 text-amber-800 ring-amber-200",
  THEY_OWE: "bg-sky-50 text-sky-800 ring-sky-200",
  SETTLED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export const eur = (n: number) => `€${n.toFixed(2)}`;
