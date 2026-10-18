import { beforeEach, describe, expect, it } from "vitest";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ticketListWhere, ticketRights } from "@/lib/auth/access";
import { can } from "@/lib/auth/permissions";
import {
  CASH_ACTIVE_BOOKINGS,
  CASH_SEATS_PER_TRIP,
  CashLimitError,
  assertCashBookingAllowed,
  closeNoShowReservations,
  phoneKey,
} from "@/lib/tickets/cashLimits";
import { blockedFor, clearHits, recordHit } from "@/lib/security/rateLimit";

async function clean() {
  await prisma.rateLimit.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.seatHold.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.ticketHistory.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.carrier.deleteMany();
  await prisma.user.deleteMany();
}
beforeEach(clean);

let n = 0;
async function user(role: Role = "CUSTOMER") {
  n += 1;
  return prisma.user.create({ data: { email: `u${n}-${role.toLowerCase()}@access.test`, password: "x", role } });
}
async function trip(hoursAhead = 48) {
  const carrier = await prisma.carrier.create({ data: { name: `C${(n += 1)}` } });
  const dep = new Date(Date.now() + hoursAhead * 3_600_000);
  return prisma.trip.create({
    data: {
      fromCity: "Київ",
      toCity: "Прага",
      departureTime: dep,
      arrivalTime: new Date(dep.getTime() + 20 * 3_600_000),
      price: 80,
      carrierId: carrier.id,
    },
  });
}
async function booking(opts: { userId: string; tripId: string; phone?: string; status?: "RESERVED" | "PAID_CASH"; cashBy?: string; group?: string }) {
  const ticket = await prisma.ticket.create({
    data: {
      userId: opts.userId,
      tripId: opts.tripId,
      status: opts.status ?? "RESERVED",
      basePrice: 80,
      finalPrice: 80,
      cashCollectedById: opts.cashBy ?? null,
    },
  });
  await prisma.booking.create({
    data: {
      reference: `AB-${(n += 1).toString().padStart(5, "0")}`,
      groupRef: opts.group ?? null,
      firstName: "Тест",
      lastName: "Пасажир",
      phone: opts.phone ?? "+380 67 000 00 00",
      email: "p@access.test",
      finalPrice: 80,
      ticketId: ticket.id,
    },
  });
  return ticket;
}
const who = (u: { id: string; role: Role }) => ({ sub: u.id, role: u.role });

describe("ticket reach and permissions", () => {
  it("agents work only with tickets they sold or took cash for", async () => {
    const [agent, other, passenger] = [await user("AGENT"), await user("AGENT"), await user()];
    const t = await trip();
    const sold = await booking({ userId: agent.id, tripId: t.id });
    const cash = await booking({ userId: passenger.id, tripId: t.id, status: "PAID_CASH", cashBy: agent.id });
    const foreign = await booking({ userId: other.id, tripId: t.id });

    expect((await ticketRights(who(agent), sold)).canEdit).toBe(true);
    expect((await ticketRights(who(agent), cash)).canView).toBe(true);
    const r = await ticketRights(who(agent), foreign);
    expect(r.canView).toBe(false);
    expect(r.canEdit).toBe(false);

    const listed = await prisma.ticket.findMany({ where: await ticketListWhere(who(agent)), select: { id: true } });
    expect(listed.map((x) => x.id).sort()).toEqual([sold.id, cash.id].sort());
  });

  it("office roles see every ticket; switching a box off in the table really removes the right", async () => {
    const [manager, passenger] = [await user("MANAGER"), await user()];
    const t = await trip();
    const ticket = await booking({ userId: passenger.id, tripId: t.id });
    expect((await ticketRights(who(manager), ticket)).canCancel).toBe(true);

    await prisma.rolePermission.create({ data: { role: "MANAGER", permission: "booking.cancel", allowed: false } });
    const after = await ticketRights(who(manager), ticket);
    expect(after.canView).toBe(true);
    expect(after.canCancel).toBe(false);

    await prisma.rolePermission.create({ data: { role: "MANAGER", permission: "booking.read", allowed: false } });
    expect((await ticketRights(who(manager), ticket)).canView).toBe(false);
  });

  it("a passenger keeps their own rights and sees only their tickets", async () => {
    const [a, b] = [await user(), await user()];
    const t = await trip();
    const mine = await booking({ userId: a.id, tripId: t.id });
    const theirs = await booking({ userId: b.id, tripId: t.id });
    expect((await ticketRights(who(a), mine)).canView).toBe(true);
    expect((await ticketRights(who(a), mine)).isStaff).toBe(false);
    expect((await ticketRights(who(a), theirs)).canView).toBe(false);
    const listed = await prisma.ticket.findMany({ where: await ticketListWhere(who(a)) });
    expect(listed.map((x) => x.id)).toEqual([mine.id]);
  });

  it("company finances stay with office roles even if the table grants them to an agent", async () => {
    await prisma.rolePermission.create({ data: { role: "AGENT", permission: "finance.read", allowed: true } });
    expect(await can({ role: "AGENT" }, "finance.read")).toBe(false);
    expect(await can({ role: "ACCOUNTANT" }, "finance.read")).toBe(true);
  });
});

describe("pay-on-the-bus limits", () => {
  it("normalises phone numbers", () => {
    expect(phoneKey("+380 (67) 123-45-67")).toBe(phoneKey("0671234567"));
  });

  it(`allows up to ${CASH_SEATS_PER_TRIP} seats per trip for one phone, across accounts`, async () => {
    const [a, b] = [await user(), await user()];
    const t = await trip();
    for (let i = 0; i < 3; i += 1) await booking({ userId: a.id, tripId: t.id, phone: "+380671234567", group: "G1" });
    await expect(assertCashBookingAllowed({ userId: b.id, phone: "067 123 45 67", tripId: t.id, seats: 1 })).resolves.toBeUndefined();
    await expect(assertCashBookingAllowed({ userId: b.id, phone: "067 123 45 67", tripId: t.id, seats: 2 })).rejects.toBeInstanceOf(CashLimitError);
  });

  it(`allows at most ${CASH_ACTIVE_BOOKINGS} open bookings; paid and past ones do not count`, async () => {
    const a = await user();
    for (let i = 0; i < CASH_ACTIVE_BOOKINGS; i += 1) {
      const t = await trip(24 + i);
      await booking({ userId: a.id, tripId: t.id, phone: "+380501112233" });
    }
    const next = await trip(100);
    await expect(assertCashBookingAllowed({ userId: a.id, phone: "+380509999999", tripId: next.id, seats: 1 })).rejects.toThrow(/неоплачені/);

    const paid = await prisma.ticket.findFirstOrThrow({ where: { userId: a.id } });
    await prisma.ticket.update({ where: { id: paid.id }, data: { status: "PAID_CASH" } });
    const past = await trip(-72);
    await booking({ userId: a.id, tripId: past.id, phone: "+380501112233" });
    await expect(assertCashBookingAllowed({ userId: a.id, phone: "+380509999999", tripId: next.id, seats: 1 })).resolves.toBeUndefined();
  });

  it("closes unpaid reservations as no-show 12 h after arrival", async () => {
    const a = await user();
    const old = await trip(-60);
    const soon = await trip(2);
    const gone = await booking({ userId: a.id, tripId: old.id });
    const kept = await booking({ userId: a.id, tripId: soon.id });
    expect(await closeNoShowReservations()).toBe(1);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: gone.id } })).status).toBe("CANCELLED");
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: kept.id } })).status).toBe("RESERVED");
    const history = await prisma.ticketHistory.findFirst({ where: { ticketId: gone.id, action: "NO_SHOW" } });
    expect(history).not.toBeNull();
  });
});

describe("rate limit", () => {
  it("blocks after the limit within the window and resets on clear", async () => {
    const rule = { limit: 3, windowMs: 60_000 };
    for (let i = 0; i < 3; i += 1) {
      expect(await blockedFor("t:key", rule)).toBe(0);
      await recordHit("t:key", rule);
    }
    expect(await blockedFor("t:key", rule)).toBeGreaterThan(0);
    await clearHits("t:key");
    expect(await blockedFor("t:key", rule)).toBe(0);
  });

  it("starts a fresh window once the old one expired", async () => {
    const rule = { limit: 1, windowMs: 60_000 };
    await prisma.rateLimit.create({ data: { key: "t:old", count: 5, resetAt: new Date(Date.now() - 1000) } });
    expect(await blockedFor("t:old", rule)).toBe(0);
    await recordHit("t:old", rule);
    expect((await prisma.rateLimit.findUniqueOrThrow({ where: { key: "t:old" } })).count).toBe(1);
  });
});
