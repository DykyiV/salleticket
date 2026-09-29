import { prisma } from "@/lib/db";
import { AGENT_ROLES } from "@/lib/finance/reconciliation";

/**
 * Who received the cash when a ticket is marked PAID_CASH.
 *
 *   ME      — the staff member marking it (sales agent / agency cash desk).
 *             The money stays with them until the mutual settlement, and the
 *             reconciliation counts it against them.
 *   CARRIER — the passenger paid the driver / carrier on the bus.
 *
 * Without an explicit choice a sales agent (AGENT / PARTNER role or a reward
 * %) defaults to ME — agents take cash at their desk — and anyone else to
 * CARRIER, the historical meaning of "paid in cash".
 */
export const CASH_COLLECTORS = ["ME", "CARRIER"] as const;
export type CashCollectorChoice = (typeof CASH_COLLECTORS)[number];

export const CARRIER_CASH_LABEL = "Водій / перевізник (в автобусі)";

export class CashCollectorError extends Error {}

export async function resolveCashCollector(
  userId: string,
  choice?: unknown
): Promise<{ id: string | null; label: string; choice: CashCollectorChoice }> {
  if (choice !== undefined && choice !== null && !CASH_COLLECTORS.includes(choice as CashCollectorChoice)) {
    throw new CashCollectorError("`cashCollector` має бути ME або CARRIER");
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true, agentRewardPercent: true },
  });
  if (!user) throw new CashCollectorError("Користувача не знайдено");
  const isAgent = AGENT_ROLES.includes(user.role) || user.agentRewardPercent != null;
  const resolved: CashCollectorChoice = (choice as CashCollectorChoice | undefined) ?? (isAgent ? "ME" : "CARRIER");
  return resolved === "ME"
    ? { id: userId, label: user.email, choice: "ME" }
    : { id: null, label: CARRIER_CASH_LABEL, choice: "CARRIER" };
}
