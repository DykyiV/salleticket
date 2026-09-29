import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resolveCommission } from "@/lib/commission";
import { generateSettlements, getPeriodReport } from "@/lib/settlements";
import { can } from "@/lib/auth/permissions";

/**
 * Money features ported from `main` onto the operational model: commission
 * resolution, monthly settlements (third-party carriers only), and the
 * permission gate that lets an ACCOUNTANT in while keeping AGENTs out.
 */

const PERIOD = "2026-08";
const IN_PERIOD = new Date("2026-08-15T10:00:00.000Z");

async function clean() {
  await prisma.counterpartyPayment.deleteMany();
  await prisma.autoReportSetting.deleteMany();
  await prisma.settlementEvent.deleteMany();
  await prisma.ticket.updateMany({ data: { settlementId: null } });
  await prisma.settlement.deleteMany();
  await prisma.commissionRule.deleteMany();
  await prisma.rolePermission.deleteMany();
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

async function sale(opts: {
  carrierName: string;
  isOwnFleet?: boolean;
  commissionPercent?: number;
  status: "PAID_ONLINE" | "PAID_CASH" | "RESERVED" | "AWAITING_PAYMENT" | "CANCELLED";
  price: number;
}) {
  const carrier = await prisma.carrier.upsert({
    where: { name: opts.carrierName },
    create: {
      name: opts.carrierName,
      isOwnFleet: opts.isOwnFleet ?? false,
      commissionPercent: opts.commissionPercent ?? 10,
    },
    update: {},
  });
  const trip = await prisma.trip.create({
    data: {
      fromCity: "Київ",
      toCity: "Берлін",
      departureTime: new Date("2026-08-20T08:00:00.000Z"),
      arrivalTime: new Date("2026-08-21T06:00:00.000Z"),
      price: opts.price,
      carrierId: carrier.id,
    },
  });
  const user = await prisma.user.create({
    data: { email: `u${Math.random().toString(36).slice(2, 10)}@test.local`, password: "x" },
  });
  const split = carrier.isOwnFleet
    ? null
    : await resolveCommission(prisma, carrier.id, "Київ", "Берлін", opts.price);
  return prisma.ticket.create({
    data: {
      userId: user.id,
      tripId: trip.id,
      status: opts.status,
      basePrice: opts.price,
      finalPrice: opts.price,
      commissionPercent: split?.percent ?? null,
      commissionAmount: split?.commissionAmount ?? null,
      carrierAmount: split?.carrierAmount ?? null,
      createdAt: IN_PERIOD,
    },
  });
}

describe("resolveCommission", () => {
  it("uses the route rule over the carrier default, else the default", async () => {
    const carrier = await prisma.carrier.create({
      data: { name: "Grandes Tour", commissionPercent: 12 },
    });
    await prisma.commissionRule.create({
      data: { carrierId: carrier.id, fromCity: "Київ", toCity: "Берлін", percent: 20 },
    });

    const onRule = await resolveCommission(prisma, carrier.id, "Київ", "Берлін", 100);
    expect(onRule).toMatchObject({ percent: 20, commissionAmount: 20, carrierAmount: 80, source: "ROUTE_RULE" });

    // A sold segment is matched by its own cities, so it falls back here.
    const onSegment = await resolveCommission(prisma, carrier.id, "Львів", "Берлін", 99.99);
    expect(onSegment).toMatchObject({ percent: 12, commissionAmount: 12, carrierAmount: 87.99, source: "CARRIER_DEFAULT" });
  });
});

describe("settlements", () => {
  it("settle third-party carriers only — never the platform's own fleet", async () => {
    await sale({ carrierName: "Grandes Tour", commissionPercent: 10, status: "PAID_ONLINE", price: 100 });
    await sale({ carrierName: "Grandes Tour", commissionPercent: 10, status: "PAID_CASH", price: 50 });
    await sale({ carrierName: "Asol BUS", isOwnFleet: true, status: "PAID_ONLINE", price: 99 });

    const report = await getPeriodReport(PERIOD);
    expect(report.map((r) => r.carrierName)).toEqual(["Grandes Tour"]);
    expect(report[0]).toMatchObject({
      ticketCount: 2,
      grossAmount: 150,
      commissionAmount: 15,
      balanceAmount: 85, // 90 owed on the online sale − 5 owed to us on the cash one
      balanceDirection: "TO_CARRIER",
    });

    const generated = await generateSettlements(PERIOD, "test");
    expect(generated).toHaveLength(1);
    expect(generated[0].carrierName).toBe("Grandes Tour");

    const ownFleetTicket = await prisma.ticket.findFirst({
      where: { trip: { carrier: { name: "Asol BUS" } } },
    });
    expect(ownFleetTicket?.settlementId).toBeNull();
  });

  it("is idempotent and excludes cancelled sales; awaiting payment is reported unpaid", async () => {
    await sale({ carrierName: "EuroRail", status: "PAID_ONLINE", price: 100 });
    await sale({ carrierName: "EuroRail", status: "AWAITING_PAYMENT", price: 40 });
    await sale({ carrierName: "EuroRail", status: "CANCELLED", price: 999 });

    const [row] = await getPeriodReport(PERIOD);
    expect(row).toMatchObject({ ticketCount: 2, grossAmount: 140, unpaidAmount: 40 });

    expect(await generateSettlements(PERIOD, "test")).toHaveLength(1);
    expect(await generateSettlements(PERIOD, "test")).toHaveLength(0);
    expect(await prisma.settlement.count()).toBe(1);
  });
});

describe("permission matrix — explicit rows win, missing rows use defaults", () => {
  it("finance.read reaches ACCOUNTANT and MANAGER but not AGENT on a fresh DB", async () => {
    expect(await can({ role: "ACCOUNTANT" }, "finance.read")).toBe(true);
    expect(await can({ role: "ACCOUNTANT" }, "finance.edit")).toBe(true);
    expect(await can({ role: "MANAGER" }, "finance.read")).toBe(true);
    expect(await can({ role: "MANAGER" }, "finance.edit")).toBe(false);
    expect(await can({ role: "AGENT" }, "finance.read")).toBe(false);
    expect(await can({ role: "ADMIN" }, "finance.edit")).toBe(true);
  });

  it("a DB seeded before finance.* existed still grants the new defaults", async () => {
    // Pre-merge install: ACCOUNTANT already has rows, but none for finance.*.
    await prisma.rolePermission.create({
      data: { role: "ACCOUNTANT", permission: "booking.read", allowed: true },
    });
    expect(await can({ role: "ACCOUNTANT" }, "finance.read")).toBe(true);
  });

  it("an admin's explicit revoke wins over the default", async () => {
    await prisma.rolePermission.create({
      data: { role: "ACCOUNTANT", permission: "finance.edit", allowed: false },
    });
    expect(await can({ role: "ACCOUNTANT" }, "finance.edit")).toBe(false);
    expect(await can({ role: "ACCOUNTANT" }, "finance.read")).toBe(true);
  });

  it("an explicit grant beyond the defaults is honoured", async () => {
    await prisma.rolePermission.create({
      data: { role: "AGENT", permission: "finance.read", allowed: true },
    });
    expect(await can({ role: "AGENT" }, "finance.read")).toBe(true);
  });
});
