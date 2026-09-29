import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { generateSettlements, markSettlementPaid } from "@/lib/settlements";
import { getReconciliation, parsePaymentInput, PaymentInputError, recordPayment } from "@/lib/finance/reconciliation";
import {
  AutoReportInputError,
  listAutoReportRows,
  parseAutoReportSave,
  runAutoReports,
  saveAutoReports,
  setAutoReportsEnabled,
} from "@/lib/finance/autoReports";

/**
 * Звірка (accrued / paid / debt) for carriers and agents, and the monthly
 * auto-report run that ships switched off.
 */

const PERIOD = "2026-08";
const IN_PERIOD = new Date("2026-08-15T10:00:00.000Z");
const RUN_DAY = (day: number) => new Date(Date.UTC(2026, 8, day, 6, 17)); // September → reports August

async function clean() {
  await prisma.counterpartyPayment.deleteMany();
  await prisma.autoReportSetting.deleteMany();
  await prisma.siteSetting.deleteMany({ where: { key: "autoReports.enabled" } });
  await prisma.settlementEvent.deleteMany();
  await prisma.ticket.updateMany({ data: { settlementId: null } });
  await prisma.settlement.deleteMany();
  await prisma.commissionRule.deleteMany();
  await prisma.seatHold.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.ticketHistory.deleteMany();
  await prisma.ticketComment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.carrier.deleteMany();
  await prisma.user.deleteMany();
}

beforeEach(clean);
afterAll(clean);

async function carrier(name: string, commissionPercent = 10) {
  return prisma.carrier.create({ data: { name, commissionPercent } });
}

async function sale(opts: {
  carrierId: string;
  userId: string;
  price: number;
  status: "PAID_ONLINE" | "PAID_CASH" | "RESERVED";
  commissionPercent?: number;
  agentRewardPercent?: number | null;
}) {
  const trip = await prisma.trip.create({
    data: {
      fromCity: "Київ",
      toCity: "Львів",
      departureTime: new Date("2026-08-20T08:00:00.000Z"),
      arrivalTime: new Date("2026-08-20T14:00:00.000Z"),
      price: opts.price,
      carrierId: opts.carrierId,
    },
  });
  const pct = opts.commissionPercent ?? 10;
  const commission = Math.round(opts.price * pct) / 100;
  return prisma.ticket.create({
    data: {
      userId: opts.userId,
      tripId: trip.id,
      status: opts.status,
      basePrice: opts.price,
      finalPrice: opts.price,
      commissionPercent: pct,
      commissionAmount: commission,
      carrierAmount: Math.round((opts.price - commission) * 100) / 100,
      agentRewardPercent: opts.agentRewardPercent ?? null,
      createdAt: IN_PERIOD,
    },
  });
}

async function user(email: string, role: "CUSTOMER" | "AGENT" = "CUSTOMER", agentRewardPercent: number | null = null) {
  return prisma.user.create({ data: { email, password: "x", role, agentRewardPercent } });
}

describe("carrier reconciliation", () => {
  it("accrues settlement balances, subtracts payments, shows who owes whom", async () => {
    const gt = await carrier("Grandes Tour");
    const buyer = await user("buyer@test.local");
    await sale({ carrierId: gt.id, userId: buyer.id, price: 100, status: "PAID_ONLINE" }); // we owe 90
    await sale({ carrierId: gt.id, userId: buyer.id, price: 50, status: "PAID_CASH" }); // it owes us 5
    await generateSettlements(PERIOD, "test");

    let row = (await getReconciliation()).carriers[0];
    expect(row).toMatchObject({ name: "Grandes Tour", documents: 1, detail: PERIOD, accrued: 85, paid: 0, debt: 85, side: "WE_OWE" });

    await recordPayment(parsePaymentInput({ kind: "CARRIER", counterpartyId: gt.id, direction: "OUTGOING", amount: 60, paidAt: "2026-09-10" }), "acc@test");
    row = (await getReconciliation()).carriers[0];
    expect(row).toMatchObject({ accrued: 85, paid: 60, debt: 25, side: "WE_OWE" });
  });

  it("marking a settlement paid records the uncovered remainder, so the debt closes", async () => {
    const gt = await carrier("Grandes Tour");
    const buyer = await user("buyer@test.local");
    await sale({ carrierId: gt.id, userId: buyer.id, price: 100, status: "PAID_ONLINE" });
    const [settlement] = await generateSettlements(PERIOD, "test");
    await recordPayment(
      parsePaymentInput({ kind: "CARRIER", counterpartyId: gt.id, direction: "OUTGOING", amount: 40, paidAt: "2026-09-10", settlementId: settlement.id }),
      "acc@test"
    );

    await markSettlementPaid(settlement.id, "acc@test");

    const payments = await prisma.counterpartyPayment.findMany({ where: { settlementId: settlement.id }, orderBy: { amount: "asc" } });
    expect(payments.map((p) => [p.direction, p.amount])).toEqual([
      ["OUTGOING", 40],
      ["OUTGOING", 50],
    ]);
    expect((await getReconciliation()).carriers[0]).toMatchObject({ debt: 0, side: "SETTLED" });
  });

  it("a partial payment entered without a settlement link is not paid twice on «mark paid»", async () => {
    const gt = await carrier("Grandes Tour");
    const buyer = await user("buyer@test.local");
    await sale({ carrierId: gt.id, userId: buyer.id, price: 100, status: "PAID_ONLINE" }); // we owe 90
    const [settlement] = await generateSettlements(PERIOD, "test");
    await recordPayment(parsePaymentInput({ kind: "CARRIER", counterpartyId: gt.id, direction: "OUTGOING", amount: 30, paidAt: "2026-09-10" }), "acc@test");

    await markSettlementPaid(settlement.id, "acc@test");

    const auto = await prisma.counterpartyPayment.findFirst({ where: { settlementId: settlement.id } });
    expect(auto).toMatchObject({ direction: "OUTGOING", amount: 60 });
    expect((await getReconciliation()).carriers[0]).toMatchObject({ paid: 90, debt: 0, side: "SETTLED" });
  });

  it("marking paid records nothing when the carrier is already fully paid", async () => {
    const gt = await carrier("Grandes Tour");
    const buyer = await user("buyer@test.local");
    await sale({ carrierId: gt.id, userId: buyer.id, price: 100, status: "PAID_ONLINE" });
    const [settlement] = await generateSettlements(PERIOD, "test");
    await recordPayment(parsePaymentInput({ kind: "CARRIER", counterpartyId: gt.id, direction: "OUTGOING", amount: 90, paidAt: "2026-09-10" }), "acc@test");

    await markSettlementPaid(settlement.id, "acc@test");

    expect(await prisma.counterpartyPayment.count()).toBe(1);
    expect((await getReconciliation()).carriers[0]).toMatchObject({ debt: 0, side: "SETTLED" });
  });

  it("a carrier owing us is shown negative and closed by an incoming payment", async () => {
    const gt = await carrier("EuroRail");
    const buyer = await user("buyer@test.local");
    await sale({ carrierId: gt.id, userId: buyer.id, price: 200, status: "PAID_CASH" }); // owes us 20
    const [settlement] = await generateSettlements(PERIOD, "test");
    expect((await getReconciliation()).carriers[0]).toMatchObject({ accrued: -20, debt: -20, side: "THEY_OWE" });

    await markSettlementPaid(settlement.id, "acc@test");
    const [p] = await prisma.counterpartyPayment.findMany();
    expect(p).toMatchObject({ direction: "INCOMING", amount: 20 });
    expect((await getReconciliation()).carriers[0].side).toBe("SETTLED");
  });

  it("rejects bad payment input and foreign settlements", async () => {
    const a = await carrier("A");
    const b = await carrier("B");
    const buyer = await user("buyer@test.local");
    await sale({ carrierId: b.id, userId: buyer.id, price: 10, status: "PAID_ONLINE" });
    const [sb] = await generateSettlements(PERIOD, "test");

    expect(() => parsePaymentInput({ kind: "CARRIER", counterpartyId: a.id, direction: "OUTGOING", amount: 0, paidAt: "2026-09-10" })).toThrow(PaymentInputError);
    expect(() => parsePaymentInput({ kind: "CARRIER", counterpartyId: a.id, direction: "UP", amount: 5, paidAt: "2026-09-10" })).toThrow(PaymentInputError);
    expect(() => parsePaymentInput({ kind: "CARRIER", counterpartyId: a.id, direction: "OUTGOING", amount: 5, paidAt: "10.09.2026" })).toThrow(PaymentInputError);
    await expect(
      recordPayment(parsePaymentInput({ kind: "CARRIER", counterpartyId: a.id, direction: "OUTGOING", amount: 5, paidAt: "2026-09-10", settlementId: sb.id }), "x")
    ).rejects.toThrow(PaymentInputError);
    // A customer is not an agent counterparty.
    await expect(
      recordPayment(parsePaymentInput({ kind: "AGENT", counterpartyId: buyer.id, direction: "OUTGOING", amount: 5, paidAt: "2026-09-10" }), "x")
    ).rejects.toThrow(PaymentInputError);
  });
});

describe("agent reconciliation", () => {
  it("accrues the reward on paid sales only, frozen % first, current % as fallback", async () => {
    const gt = await carrier("Grandes Tour");
    const agent = await user("agent@test.local", "AGENT", 5);
    await sale({ carrierId: gt.id, userId: agent.id, price: 100, status: "PAID_ONLINE", agentRewardPercent: 10 }); // 10
    await sale({ carrierId: gt.id, userId: agent.id, price: 40, status: "PAID_CASH" }); // legacy → 5% = 2
    await sale({ carrierId: gt.id, userId: agent.id, price: 999, status: "RESERVED", agentRewardPercent: 10 }); // not paid

    await recordPayment(parsePaymentInput({ kind: "AGENT", counterpartyId: agent.id, direction: "OUTGOING", amount: 7, paidAt: "2026-09-01" }), "acc@test");

    const [row] = (await getReconciliation()).agents;
    expect(row).toMatchObject({ documents: 2, salesGross: 140, detail: "5%", accrued: 12, paid: 7, debt: 5, side: "WE_OWE" });
  });

  it("lists AGENT/PARTNER roles and anyone with a reward %, not plain customers", async () => {
    await user("agent@test.local", "AGENT");
    await user("customer@test.local");
    await user("reseller@test.local", "CUSTOMER", 3);
    const names = (await getReconciliation()).agents.map((a) => a.name);
    expect(names).toEqual(["agent@test.local", "reseller@test.local"]);
  });
});

describe("auto-reports", () => {
  it("rows default to off, day 7; saving validates and stores the agent %", async () => {
    const gt = await carrier("Grandes Tour");
    const agent = await user("agent@test.local", "AGENT");
    let rows = await listAutoReportRows();
    expect(rows.carriers[0]).toMatchObject({ id: gt.id, enabled: false, sendDay: 7, email: null });
    expect(rows.agents[0]).toMatchObject({ id: agent.id, enabled: false, fallbackEmail: "agent@test.local", rewardPercent: null });

    expect(() => parseAutoReportSave({ rows: [{ kind: "CARRIER", id: gt.id, sendDay: 31 }] })).toThrow(AutoReportInputError);
    expect(() => parseAutoReportSave({ rows: [{ kind: "CARRIER", id: gt.id, sendDay: 5, email: "nope" }] })).toThrow(AutoReportInputError);
    expect(() => parseAutoReportSave({ rows: [{ kind: "AGENT", id: agent.id, sendDay: 5, rewardPercent: 120 }] })).toThrow(AutoReportInputError);

    await saveAutoReports(
      parseAutoReportSave({
        rows: [
          { kind: "CARRIER", id: gt.id, enabled: true, sendDay: 10, email: "buh@gt.ua" },
          { kind: "AGENT", id: agent.id, enabled: true, sendDay: 3, email: "", rewardPercent: "4.5" },
        ],
      })
    );
    rows = await listAutoReportRows();
    expect(rows.carriers[0]).toMatchObject({ enabled: true, sendDay: 10, email: "buh@gt.ua" });
    expect(rows.agents[0]).toMatchObject({ enabled: true, sendDay: 3, email: null, rewardPercent: 4.5 });
  });

  it("sends nothing while the global switch is off", async () => {
    const gt = await carrier("Grandes Tour");
    const buyer = await user("buyer@test.local");
    await sale({ carrierId: gt.id, userId: buyer.id, price: 100, status: "PAID_ONLINE" });
    await prisma.autoReportSetting.create({ data: { kind: "CARRIER", carrierId: gt.id, enabled: true, sendDay: 1, email: "buh@gt.ua" } });

    const run = await runAutoReports(RUN_DAY(15));
    expect(run).toMatchObject({ enabled: false, period: PERIOD, results: [] });
    expect(await prisma.settlement.count()).toBe(0);
  });

  it("when on: only ticked rows whose day has come, once per period; per-carrier settlement", async () => {
    const gt = await carrier("Grandes Tour");
    const eu = await carrier("EuroLines");
    const other = await carrier("Not ticked");
    const buyer = await user("buyer@test.local");
    for (const c of [gt, eu, other]) await sale({ carrierId: c.id, userId: buyer.id, price: 100, status: "PAID_ONLINE" });
    await prisma.autoReportSetting.createMany({
      data: [
        { kind: "CARRIER", carrierId: gt.id, enabled: true, sendDay: 5, email: "buh@gt.ua" },
        { kind: "CARRIER", carrierId: eu.id, enabled: true, sendDay: 20, email: "buh@eu.ua" },
        { kind: "CARRIER", carrierId: other.id, enabled: false, sendDay: 1, email: "x@y.ua" },
      ],
    });
    await setAutoReportsEnabled(true);

    const first = await runAutoReports(RUN_DAY(7));
    expect(first.results.map((r) => [r.name, r.status])).toEqual([["Grandes Tour", "PREPARED"]]);
    // Only the due carrier got a settlement; the others wait.
    expect((await prisma.settlement.findMany({ include: { carrier: true } })).map((s) => s.carrier.name)).toEqual(["Grandes Tour"]);

    // Re-running the same day, or a later day, does not send Grandes Tour twice.
    expect((await runAutoReports(RUN_DAY(7))).results).toEqual([]);
    const later = await runAutoReports(RUN_DAY(21));
    expect(later.results.map((r) => r.name)).toEqual(["EuroLines"]);
    expect(await prisma.autoReportSetting.findFirst({ where: { carrierId: gt.id } })).toMatchObject({ lastSentPeriod: PERIOD });
  });

  it("a carrier without e-mail is retried later; an agent falls back to the account e-mail", async () => {
    const gt = await carrier("Grandes Tour");
    const agent = await user("agent@test.local", "AGENT", 5);
    await sale({ carrierId: gt.id, userId: agent.id, price: 100, status: "PAID_ONLINE" });
    await prisma.autoReportSetting.createMany({
      data: [
        { kind: "CARRIER", carrierId: gt.id, enabled: true, sendDay: 1 },
        { kind: "AGENT", userId: agent.id, enabled: true, sendDay: 1 },
      ],
    });
    await setAutoReportsEnabled(true);

    const run = await runAutoReports(RUN_DAY(2));
    const byKind = Object.fromEntries(run.results.map((r) => [r.kind, r]));
    expect(byKind.CARRIER).toMatchObject({ status: "NO_EMAIL" });
    expect(byKind.AGENT).toMatchObject({ status: "PREPARED", to: "agent@test.local", subject: `Звіт агента за ${PERIOD}` });
    expect(await prisma.autoReportSetting.findFirst({ where: { carrierId: gt.id } })).toMatchObject({ lastSentPeriod: null });
  });
});
