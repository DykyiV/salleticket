import { prisma } from "@/lib/db";
import { generateSettlements, markSettlementSent, periodRange, previousPeriod } from "@/lib/settlements";
import { agentReward, round2 } from "@/lib/finance/money";
import { agentWhere, getAgentReconciliation, PAID_STATUSES, type CounterpartyKind } from "@/lib/finance/reconciliation";
import { sendFinanceMail } from "@/lib/finance/mailer";

/**
 * Monthly auto-reports to counterparties.
 *
 * Each third-party carrier and each sales agent has a row: send or not
 * (checkbox), day of month, e-mail. A daily cron (POST /api/cron/auto-reports)
 * sends the previous month's report to every row that is due. Nothing is
 * sent while the global switch is off — it ships off, to be enabled later.
 *
 *   carrier → its settlement for the month (generated if missing) with the
 *             balance, invoice and act numbers;
 *   agent   → paid sales and reward for the month plus the open balance.
 */

export const AUTO_REPORTS_KEY = "autoReports.enabled";
export const MIN_DAY = 1;
export const MAX_DAY = 28; // every month has it
export const DEFAULT_DAY = 7;

export async function getAutoReportsEnabled(): Promise<boolean> {
  const row = await prisma.siteSetting.findUnique({ where: { key: AUTO_REPORTS_KEY } });
  return row?.value === "true";
}

export async function setAutoReportsEnabled(on: boolean): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key: AUTO_REPORTS_KEY },
    create: { key: AUTO_REPORTS_KEY, value: String(on) },
    update: { value: String(on) },
  });
}

export type AutoReportRow = {
  kind: CounterpartyKind;
  /** carrierId or userId */
  id: string;
  name: string;
  enabled: boolean;
  sendDay: number;
  email: string | null;
  /** Agents: the account e-mail used when `email` is empty. */
  fallbackEmail: string | null;
  /** Agents: reward percent of paid sales. */
  rewardPercent?: number | null;
  lastSentPeriod: string | null;
  lastSentAt: Date | null;
};

export async function listAutoReportRows(): Promise<{ carriers: AutoReportRow[]; agents: AutoReportRow[] }> {
  const [carriers, agents] = await Promise.all([
    prisma.carrier.findMany({
      where: { isOwnFleet: false },
      select: { id: true, name: true, autoReportSetting: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: agentWhere,
      select: { id: true, email: true, displayName: true, agentRewardPercent: true, autoReportSetting: true },
      orderBy: { email: "asc" },
    }),
  ]);
  return {
    carriers: carriers.map((c) => ({
      kind: "CARRIER",
      id: c.id,
      name: c.name,
      enabled: c.autoReportSetting?.enabled ?? false,
      sendDay: c.autoReportSetting?.sendDay ?? DEFAULT_DAY,
      email: c.autoReportSetting?.email ?? null,
      fallbackEmail: null,
      lastSentPeriod: c.autoReportSetting?.lastSentPeriod ?? null,
      lastSentAt: c.autoReportSetting?.lastSentAt ?? null,
    })),
    agents: agents.map((a) => ({
      kind: "AGENT",
      id: a.id,
      name: a.displayName ? `${a.displayName} (${a.email})` : a.email,
      enabled: a.autoReportSetting?.enabled ?? false,
      sendDay: a.autoReportSetting?.sendDay ?? DEFAULT_DAY,
      email: a.autoReportSetting?.email ?? null,
      fallbackEmail: a.email,
      rewardPercent: a.agentRewardPercent,
      lastSentPeriod: a.autoReportSetting?.lastSentPeriod ?? null,
      lastSentAt: a.autoReportSetting?.lastSentAt ?? null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

export class AutoReportInputError extends Error {}

export type AutoReportRowInput = {
  kind: CounterpartyKind;
  id: string;
  enabled: boolean;
  sendDay: number;
  email: string | null;
  rewardPercent?: number | null;
};

export type AutoReportSaveInput = { enabled?: boolean; rows: AutoReportRowInput[] };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseAutoReportSave(raw: unknown): AutoReportSaveInput {
  const b = (raw ?? {}) as Record<string, unknown>;
  const enabled = typeof b.enabled === "boolean" ? b.enabled : undefined;
  if (!Array.isArray(b.rows)) throw new AutoReportInputError("`rows` має бути масивом");
  if (b.rows.length > 1000) throw new AutoReportInputError("Забагато рядків");
  const rows = b.rows.map((r: unknown, i: number): AutoReportRowInput => {
    const row = (r ?? {}) as Record<string, unknown>;
    const where = `рядок ${i + 1}`;
    if (row.kind !== "CARRIER" && row.kind !== "AGENT") throw new AutoReportInputError(`${where}: невідомий тип`);
    if (typeof row.id !== "string" || !row.id) throw new AutoReportInputError(`${where}: немає id`);
    const sendDay = Number(row.sendDay);
    if (!Number.isInteger(sendDay) || sendDay < MIN_DAY || sendDay > MAX_DAY) {
      throw new AutoReportInputError(`${where}: день відправки — від ${MIN_DAY} до ${MAX_DAY}`);
    }
    const email = typeof row.email === "string" && row.email.trim() ? row.email.trim() : null;
    if (email && !EMAIL_RE.test(email)) throw new AutoReportInputError(`${where}: некоректний e-mail`);
    let rewardPercent: number | null | undefined;
    if (row.kind === "AGENT" && "rewardPercent" in row) {
      if (row.rewardPercent === null || row.rewardPercent === "") rewardPercent = null;
      else {
        const pct = Number(row.rewardPercent);
        if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
          throw new AutoReportInputError(`${where}: винагорода — від 0 до 100%`);
        }
        rewardPercent = round2(pct);
      }
    }
    const kind: CounterpartyKind = row.kind;
    return { kind, id: row.id, enabled: row.enabled === true, sendDay, email, rewardPercent };
  });
  return { enabled, rows };
}

export async function saveAutoReports(input: AutoReportSaveInput): Promise<void> {
  const carrierIds = input.rows.filter((r) => r.kind === "CARRIER").map((r) => r.id);
  const agentIds = input.rows.filter((r) => r.kind === "AGENT").map((r) => r.id);
  const [carriers, agents] = await Promise.all([
    prisma.carrier.findMany({ where: { id: { in: carrierIds }, isOwnFleet: false }, select: { id: true } }),
    prisma.user.findMany({ where: { id: { in: agentIds }, ...agentWhere }, select: { id: true } }),
  ]);
  const okCarriers = new Set(carriers.map((c) => c.id));
  const okAgents = new Set(agents.map((a) => a.id));
  const unknown = input.rows.find((r) => !(r.kind === "CARRIER" ? okCarriers : okAgents).has(r.id));
  if (unknown) throw new AutoReportInputError(`Контрагента ${unknown.id} не знайдено`);

  await prisma.$transaction(async (tx) => {
    if (input.enabled !== undefined) {
      await tx.siteSetting.upsert({
        where: { key: AUTO_REPORTS_KEY },
        create: { key: AUTO_REPORTS_KEY, value: String(input.enabled) },
        update: { value: String(input.enabled) },
      });
    }
    for (const r of input.rows) {
      const data = { enabled: r.enabled, sendDay: r.sendDay, email: r.email };
      if (r.kind === "CARRIER") {
        await tx.autoReportSetting.upsert({
          where: { carrierId: r.id },
          create: { kind: "CARRIER", carrierId: r.id, ...data },
          update: data,
        });
      } else {
        await tx.autoReportSetting.upsert({
          where: { userId: r.id },
          create: { kind: "AGENT", userId: r.id, ...data },
          update: data,
        });
        if (r.rewardPercent !== undefined) {
          await tx.user.update({ where: { id: r.id }, data: { agentRewardPercent: r.rewardPercent } });
        }
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Sending (cron)
// ---------------------------------------------------------------------------

export type AutoReportResult = {
  kind: CounterpartyKind;
  id: string;
  name: string;
  to: string | null;
  /**
   * SENT      — delivered by the mail provider
   * PREPARED  — report built, mail provider is still a stub
   * NO_SALES  — nothing to report for the period (marked done)
   * NO_EMAIL  — no address; retried on the next run once one is set
   */
  status: "SENT" | "PREPARED" | "NO_SALES" | "NO_EMAIL";
  subject?: string;
};

export type AutoReportRun = {
  enabled: boolean;
  period: string;
  day: number;
  results: AutoReportResult[];
};

const eur = (n: number) => `€${n.toFixed(2)}`;
const SIDE_TEXT = { WE_OWE: "до сплати вам", THEY_OWE: "до сплати нам", SETTLED: "розраховано" } as const;

export async function runAutoReports(now = new Date(), actor = "cron"): Promise<AutoReportRun> {
  const period = previousPeriod(now);
  const day = now.getUTCDate();
  if (!(await getAutoReportsEnabled())) return { enabled: false, period, day, results: [] };

  const due = await prisma.autoReportSetting.findMany({
    where: {
      enabled: true,
      sendDay: { lte: day },
      OR: [{ lastSentPeriod: null }, { lastSentPeriod: { not: period } }],
    },
    include: {
      carrier: { select: { id: true, name: true, isOwnFleet: true } },
      user: { select: { id: true, email: true, displayName: true } },
    },
  });

  const results: AutoReportResult[] = [];
  const agentBalances = due.some((d) => d.kind === "AGENT")
    ? new Map((await getAgentReconciliation()).map((r) => [r.id, r]))
    : new Map();

  for (const setting of due) {
    let result: AutoReportResult;
    if (setting.kind === "CARRIER" && setting.carrier && !setting.carrier.isOwnFleet) {
      result = await sendCarrierReport(setting.carrier, setting.email, period, actor);
    } else if (setting.kind === "AGENT" && setting.user) {
      result = await sendAgentReport(setting.user, setting.email, period, agentBalances.get(setting.user.id));
    } else {
      continue;
    }
    if (result.status !== "NO_EMAIL") {
      await prisma.autoReportSetting.update({
        where: { id: setting.id },
        data: { lastSentPeriod: period, lastSentAt: now },
      });
    }
    results.push(result);
  }
  return { enabled: true, period, day, results };
}

async function sendCarrierReport(
  carrier: { id: string; name: string },
  email: string | null,
  period: string,
  actor: string
): Promise<AutoReportResult> {
  const base = { kind: "CARRIER" as const, id: carrier.id, name: carrier.name, to: email };
  await generateSettlements(period, actor, [carrier.id]);
  const settlement = await prisma.settlement.findUnique({
    where: { carrierId_period: { carrierId: carrier.id, period } },
  });
  if (!settlement) return { ...base, status: "NO_SALES" };
  if (!email) return { ...base, status: "NO_EMAIL" };

  const direction =
    settlement.balanceDirection === "TO_CARRIER"
      ? "до сплати перевізнику"
      : settlement.balanceDirection === "TO_AGENT"
        ? "до сплати агентству"
        : "розраховано";
  const subject = `Розрахунок за ${period}: ${settlement.invoiceNumber}`;
  const text = [
    `${carrier.name}, розрахунок за ${period}.`,
    `Квитків: ${settlement.ticketCount}, виручка ${eur(settlement.grossAmount)}, комісія агентства ${eur(settlement.commissionAmount)}.`,
    `Сальдо: ${eur(settlement.balanceAmount)} (${direction}).`,
    `Рахунок ${settlement.invoiceNumber}, акт ${settlement.actNumber ?? "—"}.`,
  ].join("\n");
  const mail = await sendFinanceMail({ to: email, subject, text });
  if (mail.delivered && settlement.status === "GENERATED") {
    await markSettlementSent(settlement.id, actor);
  }
  return { ...base, status: mail.delivered ? "SENT" : "PREPARED", subject };
}

async function sendAgentReport(
  user: { id: string; email: string; displayName: string | null },
  email: string | null,
  period: string,
  balance: { debt: number; side: "WE_OWE" | "THEY_OWE" | "SETTLED"; reward?: number; cashHeld?: number } | undefined
): Promise<AutoReportResult> {
  const to = email ?? user.email;
  const name = user.displayName ? `${user.displayName} (${user.email})` : user.email;
  const base = { kind: "AGENT" as const, id: user.id, name, to };
  const { start, end } = periodRange(period);
  const [tickets, account] = await Promise.all([
    prisma.ticket.findMany({
      where: { userId: user.id, status: { in: PAID_STATUSES }, createdAt: { gte: start, lt: end } },
      select: { finalPrice: true, agentRewardPercent: true },
    }),
    prisma.user.findUnique({ where: { id: user.id }, select: { agentRewardPercent: true } }),
  ]);
  if (tickets.length === 0 && (!balance || balance.side === "SETTLED")) return { ...base, status: "NO_SALES" };

  const gross = round2(tickets.reduce((s, t) => s + t.finalPrice, 0));
  const reward = round2(
    tickets.reduce((s, t) => s + agentReward(t.finalPrice, t.agentRewardPercent ?? account?.agentRewardPercent), 0)
  );
  const subject = `Звіт агента за ${period}`;
  const text = [
    `Звіт за ${period}.`,
    `Оплачених квитків: ${tickets.length}, на суму ${eur(gross)}.`,
    `Нараховано винагороди: ${eur(reward)}.`,
    balance?.cashHeld ? `Готівка пасажирів у вас на руках (усього): ${eur(balance.cashHeld)}.` : "",
    balance
      ? `Загальне сальдо: ${eur(Math.abs(balance.debt))} (${SIDE_TEXT[balance.side]}).`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const mail = await sendFinanceMail({ to, subject, text });
  return { ...base, status: mail.delivered ? "SENT" : "PREPARED", subject };
}
