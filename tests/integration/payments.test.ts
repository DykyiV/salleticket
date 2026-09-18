import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { reconcileTicketPayment } from "@/lib/payments";
import { updateTicketVersioned, VersionConflictError } from "@/lib/tickets/version";

async function clean() {
  await prisma.seatHold.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.ticketHistory.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.carrier.deleteMany();
  await prisma.user.deleteMany();
}

async function makeAwaitingTicket(options: {
  sent?: boolean;
  settleInMinutes?: number;
  deadlineInHours?: number;
}) {
  const carrier = await prisma.carrier.create({ data: { name: "Test Carrier" } });
  const trip = await prisma.trip.create({
    data: {
      fromCity: "Київ",
      toCity: "Берлін",
      departureTime: new Date("2026-10-01T08:00:00.000Z"),
      arrivalTime: new Date("2026-10-02T06:00:00.000Z"),
      price: 99,
      carrierId: carrier.id,
    },
  });
  const user = await prisma.user.create({
    data: {
      email: `u${Math.random().toString(36).slice(2, 8)}@test.local`,
      password: "x",
    },
  });
  const ticket = await prisma.ticket.create({
    data: {
      userId: user.id,
      tripId: trip.id,
      status: "AWAITING_PAYMENT",
      basePrice: 99,
      finalPrice: 94.05,
      seatNumber: 8,
    },
  });
  const now = Date.now();
  const payment = await prisma.payment.create({
    data: {
      ticketId: ticket.id,
      status: options.sent ? "SENT" : "PENDING",
      amount: 94.05,
      fullAmount: 99,
      sentAt: options.sent ? new Date(now) : null,
      settleAfter: options.sent
        ? new Date(now + (options.settleInMinutes ?? 25) * 60_000)
        : null,
      deadlineAt: new Date(now + (options.deadlineInHours ?? 24) * 3_600_000),
    },
  });
  return { ticket, payment };
}

describe("reconcileTicketPayment", () => {
  beforeEach(clean);

  it("marks the ticket PAID_ONLINE once the settle window passed", async () => {
    const { ticket } = await makeAwaitingTicket({
      sent: true,
      settleInMinutes: -1,
    });
    await reconcileTicketPayment(ticket.id);
    const fresh = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(fresh?.status).toBe("PAID_ONLINE");
    const history = await prisma.ticketHistory.findMany({
      where: { ticketId: ticket.id, action: "PAYMENT_SETTLED" },
    });
    expect(history).toHaveLength(1);
  });

  it("keeps waiting while the settle window is still open", async () => {
    const { ticket } = await makeAwaitingTicket({
      sent: true,
      settleInMinutes: 25,
    });
    await reconcileTicketPayment(ticket.id);
    const fresh = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(fresh?.status).toBe("AWAITING_PAYMENT");
  });

  it("expires the online discount after the 24h deadline", async () => {
    const { ticket, payment } = await makeAwaitingTicket({
      sent: false,
      deadlineInHours: -1,
    });
    await reconcileTicketPayment(ticket.id);
    const fresh = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(fresh?.status).toBe("RESERVED");
    expect(fresh?.finalPrice).toBe(99);
    const expired = await prisma.payment.findUnique({
      where: { id: payment.id },
    });
    expect(expired?.status).toBe("EXPIRED");
  });

  it("does not touch tickets that are already paid", async () => {
    const { ticket } = await makeAwaitingTicket({
      sent: true,
      settleInMinutes: -1,
    });
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: "PAID_ONLINE" },
    });
    await reconcileTicketPayment(ticket.id);
    const fresh = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(fresh?.status).toBe("PAID_ONLINE");
  });
});

describe("updateTicketVersioned (optimistic concurrency)", () => {
  beforeEach(clean);

  it("bumps the version on every successful update", async () => {
    const { ticket } = await makeAwaitingTicket({ sent: false });
    const v1 = await updateTicketVersioned(prisma, ticket.id, ticket.version, {
      seatNumber: 11,
    });
    expect(v1.version).toBe(ticket.version + 1);
    const v2 = await updateTicketVersioned(prisma, ticket.id, v1.version, {
      seatNumber: 12,
    });
    expect(v2.version).toBe(ticket.version + 2);
  });

  it("rejects writers holding a stale version", async () => {
    const { ticket } = await makeAwaitingTicket({ sent: false });
    await updateTicketVersioned(prisma, ticket.id, ticket.version, {
      seatNumber: 11,
    });
    await expect(
      updateTicketVersioned(prisma, ticket.id, ticket.version, { seatNumber: 12 })
    ).rejects.toBeInstanceOf(VersionConflictError);
    const fresh = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(fresh?.seatNumber).toBe(11);
  });
});
