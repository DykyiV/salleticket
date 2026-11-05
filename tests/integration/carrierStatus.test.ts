import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { syncCarrierCancellations } from "@/lib/tickets/carrierStatus";

async function clean() {
  await prisma.ticketHistory.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.carrier.deleteMany();
  await prisma.user.deleteMany();
}

const rnd = () => Math.random().toString(36).slice(2, 8);

async function gtTicket(carrierRef: string, departureTime = new Date(Date.now() + 86_400_000)) {
  const carrier = await prisma.carrier.create({ data: { name: `Grandes Tour ${rnd()}` } });
  const trip = await prisma.trip.create({
    data: {
      fromCity: "Львів",
      toCity: "Мадрид",
      departureTime,
      arrivalTime: new Date(departureTime.getTime() + 86_400_000),
      price: 81,
      carrierId: carrier.id,
    },
  });
  const user = await prisma.user.create({ data: { email: `u${rnd()}@test.local`, password: "x" } });
  return prisma.ticket.create({
    data: { userId: user.id, tripId: trip.id, status: "RESERVED", basePrice: 81, finalPrice: 81, carrierRef },
  });
}

const statusOf = async (id: string) => (await prisma.ticket.findUnique({ where: { id } }))?.status;

describe("syncCarrierCancellations (Grandes Tour → site)", () => {
  const calls: string[] = [];

  beforeEach(async () => {
    await clean();
    calls.length = 0;
    vi.stubEnv("GRANDES_TOUR_API_KEY", "test-key");
    // GT order 10: both tickets cancelled on their side; order 20: still reserved.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL | string, init?: RequestInit) => {
        const path = new URL(String(url)).pathname;
        calls.push(`${init?.method ?? "GET"} ${path}`);
        const tickets = path.includes("/order/10/")
          ? [{ id: 100, status: "canceled" }, { id: 101, status: "canceled" }]
          : [{ id: 200, status: "reserved" }];
        return new Response(JSON.stringify({ tickets, success: true }), { status: 200 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("cancels here what GT cancelled, without sending the cancel back", async () => {
    const gone = await gtTicket("GT:10:100");
    const alive = await gtTicket("GT:20:200");

    expect(await syncCarrierCancellations([gone.id, alive.id])).toBe(1);
    expect(await statusOf(gone.id)).toBe("CANCELLED");
    expect(await statusOf(alive.id)).toBe("RESERVED");
    const history = await prisma.ticketHistory.findMany({ where: { ticketId: gone.id } });
    expect(history.map((h) => h.action)).toContain("CANCELLED_BY_CARRIER");

    await new Promise((r) => setTimeout(r, 20));
    expect(calls.some((c) => c.includes("cancel_ticket"))).toBe(false);
  });

  it("the periodic sweep checks upcoming trips only", async () => {
    const upcoming = await gtTicket("GT:10:100");
    const past = await gtTicket("GT:10:101", new Date(Date.now() - 3 * 86_400_000));

    expect(await syncCarrierCancellations()).toBe(1);
    expect(await statusOf(upcoming.id)).toBe("CANCELLED");
    expect(await statusOf(past.id)).toBe("RESERVED");
  });
});
