import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gt = vi.hoisted(() => ({ search: vi.fn(), book: vi.fn(), cancel: vi.fn(), passenger: vi.fn() }));

vi.mock("@/lib/carriers/grandes-tour", () => ({
  grandesTourCarrierAdapter: { id: "grandes-tour", transportType: "BUS", search: gt.search, book: gt.book },
}));
vi.mock("@/lib/carriers/grandes-tour/pricing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/carriers/grandes-tour/pricing")>()),
  gtCancelTicket: gt.cancel,
  gtTicketPassenger: gt.passenger,
}));

import { prisma } from "@/lib/db";
import { changeGtTicketTrip, gtChangeBlocked } from "@/lib/tickets/gtChange";

async function clean() {
  await prisma.ticketHistory.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.carrier.deleteMany();
  await prisma.user.deleteMany();
}

const NEW_TRIP = {
  id: "gt-9-1-160",
  carrierId: "grandes-tour",
  carrier: "Grandes Tour",
  from: "Львів",
  to: "Берлін",
  departure: "14:00",
  arrival: "05:45",
  departureAt: "2026-12-08T14:00:00.000Z",
  arrivalAt: "2026-12-09T05:45:00.000Z",
  price: 90,
  carrierBus: "BH1",
};

async function gtTicket() {
  const carrier = await prisma.carrier.create({ data: { name: `Grandes Tour ${Math.random()}` } });
  const trip = await prisma.trip.create({
    data: {
      fromCity: "Львів",
      toCity: "Берлін",
      departureTime: new Date("2026-12-01T14:00:00.000Z"),
      arrivalTime: new Date("2026-12-02T05:45:00.000Z"),
      price: 81,
      carrierId: carrier.id,
    },
  });
  const user = await prisma.user.create({ data: { email: `u${Math.random().toString(36).slice(2, 8)}@test.local`, password: "x" } });
  const ticket = await prisma.ticket.create({
    data: {
      userId: user.id,
      tripId: trip.id,
      status: "RESERVED",
      basePrice: 81,
      finalPrice: 81,
      commissionPercent: 10,
      commissionAmount: 8.1,
      carrierAmount: 72.9,
      seatNumber: 3,
      carrierRef: "GT:500:600",
    },
  });
  await prisma.booking.create({
    data: { reference: "KR-90001", firstName: "TEST", lastName: "TEST", phone: "+380638882688", finalPrice: 81, ticketId: ticket.id },
  });
  return ticket;
}

const change = (ticketId: string) =>
  changeGtTicketTrip({ ticketId, tripKey: NEW_TRIP.id, date: "2026-12-08", seatNumber: 12, changedBy: null, source: "ADMIN_PANEL" });

describe("changing the date / seat of a Grandes Tour ticket", () => {
  beforeEach(async () => {
    await clean();
    vi.stubEnv("GRANDES_TOUR_API_KEY", "test-key");
    gt.search.mockResolvedValue([NEW_TRIP]);
    gt.passenger.mockResolvedValue({ passengerTypeId: 55, discountCard: null });
    gt.book.mockResolvedValue({
      carrierReference: "GT-700",
      status: "confirmed",
      tickets: [{ ref: "GT:700:800", price: 90, priceBeforeDiscount: 90, kind: "YOUTH" }],
    });
    gt.cancel.mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("reserves the same passenger on the new trip, moves the ticket, then frees the old seat", async () => {
    const ticket = await gtTicket();
    expect(await change(ticket.id)).toEqual({ price: 90, oldPrice: 81 });

    const request = gt.book.mock.calls[0][0];
    expect(request.passengers[0]).toMatchObject({ name: "TEST TEST", fareTypeId: 55, seatNumber: 12 });
    expect(request.paymentAtBoarding).toBe(true);

    const moved = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id }, include: { trip: true } });
    expect(moved.trip?.departureTime.toISOString()).toBe(NEW_TRIP.departureAt);
    expect(moved).toMatchObject({ seatNumber: 12, carrierRef: "GT:700:800", finalPrice: 90, commissionAmount: 9, carrierAmount: 81 });
    expect((await prisma.booking.findFirstOrThrow({ where: { ticketId: ticket.id } })).finalPrice).toBe(90);
    const history = await prisma.ticketHistory.findMany({ where: { ticketId: ticket.id } });
    expect(history.map((h) => h.action)).toContain("TRIP_CHANGED");

    await new Promise((r) => setTimeout(r, 20));
    expect(gt.cancel).toHaveBeenCalledWith("GT:500:600");
  });

  it("changes nothing when Grandes Tour refuses the new seat", async () => {
    const ticket = await gtTicket();
    gt.book.mockRejectedValueOnce(new Error("Grandes Tour /api/v2/booking/reserve_tickets: місце зайняте"));
    await expect(change(ticket.id)).rejects.toThrow("місце зайняте");

    const same = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(same).toMatchObject({ seatNumber: 3, carrierRef: "GT:500:600", finalPrice: 81 });
    await new Promise((r) => setTimeout(r, 20));
    expect(gt.cancel).not.toHaveBeenCalled();
  });

  it("only unpaid one-way tickets are changed online", () => {
    expect(gtChangeBlocked({ status: "RESERVED", tripKind: "ONE_WAY" })).toBeNull();
    expect(gtChangeBlocked({ status: "PAID_CASH", tripKind: "ONE_WAY" })).not.toBeNull();
    expect(gtChangeBlocked({ status: "RESERVED", tripKind: "ROUND_TRIP" })).not.toBeNull();
  });
});
