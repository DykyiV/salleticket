import { Prisma, Role, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { agentReward, netPaid, reconcile, round2, signedBalance, type Direction, type Reconciled } from "@/lib/finance/money";

/**
 * Reconciliation (звірка) with every counterparty:
 *   1. accrued  — what is owed by the documents: carrier settlement balances,
 *                 agent rewards on paid sales;
 *   2. paid     — money actually transferred (CounterpartyPayment);
 *   3. debt     — accrued − paid, and who owes whom.
 * Amounts follow the sign convention in lib/finance/money.ts.
 */

export type CounterpartyKind = "CARRIER" | "AGENT";

export type ReconciliationRow = Reconciled & {
  kind: CounterpartyKind;
  id: string;
  name: string;
  /** Carriers: settlements issued; agents: paid tickets sold. */
  documents: number;
  /** Carriers: last settled period; agents: reward % now. */
  detail: string | null;
  /** Agents only: paid sales volume the reward is computed from. */
  salesGross?: number;
  /** Agents only: reward earned (in the agent's favour). */
  reward?: number;
  /** Agents only: passengers' cash the agent took and still holds (ours). */
  cashHeld?: number;
};

export type Reconciliation = {
  carriers: ReconciliationRow[];
  agents: ReconciliationRow[];
  totals: { carriers: Reconciled; agents: Reconciled };
};

/** Roles listed as sales agents even before a reward % is set. */
export const AGENT_ROLES: Role[] = [Role.AGENT, Role.PARTNER];

export const PAID_STATUSES: TicketStatus[] = [TicketStatus.PAID_ONLINE, TicketStatus.PAID_CASH];

/**
 * Agent counterparties: sales agents / partners, anyone with a reward %, and
 * anyone holding passengers' cash (a cash desk) — cash they took stays with
 * them until the mutual settlement.
 */
export const agentWhere: Prisma.UserWhereInput = {
  OR: [
    { role: { in: AGENT_ROLES } },
    { agentRewardPercent: { not: null } },
    { cashCollected: { some: { status: TicketStatus.PAID_CASH } } },
  ],
};

function sumRows(rows: ReconciliationRow[]): Reconciled {
  return reconcile(
    rows.reduce((s, r) => s + r.accrued, 0),
    rows.reduce((s, r) => s + r.paid, 0)
  );
}

async function paymentsBy(kind: CounterpartyKind) {
  const rows = await prisma.counterpartyPayment.groupBy({
    by: [kind === "CARRIER" ? "carrierId" : "userId", "direction"],
    where: { kind },
    _sum: { amount: true },
  });
  const map = new Map<string, { direction: Direction; amount: number }[]>();
  for (const r of rows) {
    const id = (kind === "CARRIER" ? r.carrierId : r.userId) as string | null;
    if (!id) continue;
    const list = map.get(id) ?? [];
    list.push({ direction: r.direction as Direction, amount: r._sum.amount ?? 0 });
    map.set(id, list);
  }
  return map;
}

export async function getCarrierReconciliation(): Promise<ReconciliationRow[]> {
  const [carriers, settlements, payments] = await Promise.all([
    prisma.carrier.findMany({
      where: { isOwnFleet: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.settlement.findMany({
      select: { carrierId: true, period: true, balanceAmount: true, balanceDirection: true },
    }),
    paymentsBy("CARRIER"),
  ]);

  return carriers.map((c) => {
    const own = settlements.filter((s) => s.carrierId === c.id);
    const accrued = own.reduce((sum, s) => sum + signedBalance(s.balanceDirection, s.balanceAmount), 0);
    const lastPeriod = own.map((s) => s.period).sort().at(-1) ?? null;
    return {
      kind: "CARRIER" as const,
      id: c.id,
      name: c.name,
      documents: own.length,
      detail: lastPeriod,
      ...reconcile(accrued, netPaid(payments.get(c.id) ?? [])),
    };
  });
}

export async function getAgentReconciliation(): Promise<ReconciliationRow[]> {
  const agents = await prisma.user.findMany({
    where: agentWhere,
    select: { id: true, email: true, displayName: true, agentRewardPercent: true },
    orderBy: { email: "asc" },
  });
  const ids = agents.map((a) => a.id);
  const [tickets, cash, payments] = await Promise.all([
    prisma.ticket.findMany({
      where: { userId: { in: ids }, status: { in: PAID_STATUSES } },
      select: { userId: true, finalPrice: true, agentRewardPercent: true },
    }),
    // Cash taken from passengers; a ticket cancelled / refunded afterwards
    // means the cash went back to the passenger, so it no longer counts.
    prisma.ticket.findMany({
      where: { cashCollectedById: { in: ids }, status: TicketStatus.PAID_CASH },
      select: { cashCollectedById: true, finalPrice: true },
    }),
    paymentsBy("AGENT"),
  ]);

  return agents.map((a) => {
    const own = tickets.filter((t) => t.userId === a.id);
    // Tickets sold before a reward % existed fall back to the current one.
    const reward = round2(
      own.reduce(
        (sum, t) => sum + agentReward(t.finalPrice, t.agentRewardPercent ?? a.agentRewardPercent),
        0
      )
    );
    const cashHeld = round2(
      cash.filter((t) => t.cashCollectedById === a.id).reduce((sum, t) => sum + t.finalPrice, 0)
    );
    // Mutual settlement: the agent keeps its reward out of the cash it holds.
    //   + we owe the agent (reward > cash), − the agent owes us (cash > reward).
    const accrued = reward - cashHeld;
    return {
      kind: "AGENT" as const,
      id: a.id,
      name: a.displayName ? `${a.displayName} (${a.email})` : a.email,
      documents: own.length,
      detail: a.agentRewardPercent != null ? `${a.agentRewardPercent}%` : null,
      salesGross: round2(own.reduce((s, t) => s + t.finalPrice, 0)),
      reward,
      cashHeld,
      ...reconcile(accrued, netPaid(payments.get(a.id) ?? [])),
    };
  });
}

export async function getReconciliation(): Promise<Reconciliation> {
  const [carriers, agents] = await Promise.all([getCarrierReconciliation(), getAgentReconciliation()]);
  return { carriers, agents, totals: { carriers: sumRows(carriers), agents: sumRows(agents) } };
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export class PaymentInputError extends Error {}

export type PaymentInput = {
  kind: CounterpartyKind;
  counterpartyId: string;
  direction: Direction;
  amount: number;
  /** YYYY-MM-DD */
  paidAt: string;
  note?: string | null;
  settlementId?: string | null;
};

export function parsePaymentInput(raw: unknown): PaymentInput {
  const b = (raw ?? {}) as Record<string, unknown>;
  const kind = b.kind;
  if (kind !== "CARRIER" && kind !== "AGENT") throw new PaymentInputError("Невідомий тип контрагента");
  const counterpartyId = typeof b.counterpartyId === "string" ? b.counterpartyId.trim() : "";
  if (!counterpartyId) throw new PaymentInputError("Не вказано контрагента");
  const direction = b.direction;
  if (direction !== "OUTGOING" && direction !== "INCOMING") throw new PaymentInputError("Невідомий напрям платежу");
  const amount = typeof b.amount === "number" ? b.amount : Number(b.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
    throw new PaymentInputError("Сума має бути більшою за нуль");
  }
  const paidAt = typeof b.paidAt === "string" ? b.paidAt : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidAt) || Number.isNaN(Date.parse(`${paidAt}T00:00:00Z`))) {
    throw new PaymentInputError("Дата має бути у форматі РРРР-ММ-ДД");
  }
  const note = typeof b.note === "string" && b.note.trim() ? b.note.trim().slice(0, 500) : null;
  const settlementId = typeof b.settlementId === "string" && b.settlementId ? b.settlementId : null;
  return { kind, counterpartyId, direction, amount: round2(amount), paidAt, note, settlementId };
}

export async function recordPayment(input: PaymentInput, actor: string) {
  if (input.kind === "CARRIER") {
    const carrier = await prisma.carrier.findUnique({ where: { id: input.counterpartyId } });
    if (!carrier || carrier.isOwnFleet) throw new PaymentInputError("Перевізника не знайдено");
  } else {
    const agent = await prisma.user.findFirst({ where: { id: input.counterpartyId, ...agentWhere } });
    if (!agent) throw new PaymentInputError("Агента не знайдено");
  }
  if (input.settlementId) {
    const s = await prisma.settlement.findUnique({ where: { id: input.settlementId } });
    if (!s || input.kind !== "CARRIER" || s.carrierId !== input.counterpartyId) {
      throw new PaymentInputError("Розрахунок не належить цьому перевізнику");
    }
  }
  return prisma.counterpartyPayment.create({
    data: {
      kind: input.kind,
      direction: input.direction,
      amount: input.amount,
      paidAt: new Date(`${input.paidAt}T12:00:00Z`),
      note: input.note ?? null,
      createdBy: actor,
      carrierId: input.kind === "CARRIER" ? input.counterpartyId : null,
      userId: input.kind === "AGENT" ? input.counterpartyId : null,
      settlementId: input.settlementId ?? null,
    },
  });
}

export async function listRecentPayments(limit = 50) {
  return prisma.counterpartyPayment.findMany({
    include: {
      carrier: { select: { name: true } },
      user: { select: { email: true, displayName: true } },
      settlement: { select: { invoiceNumber: true } },
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
}
