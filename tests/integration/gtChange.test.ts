import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gt = vi.hoisted(() => ({ search: vi.fn(), book: vi.fn(), cancel: vi.fn(), details: vi.fn() }));

vi.mock("@/lib/carriers/grandes-tour", () => ({
  grandesTourCarrierAdapter: { id: "grandes-tour", transportType: "BUS", search: gt.search, book: gt.book },
}));
vi.mock("@/lib/carriers/grandes-tour/pricing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/carriers/grandes-tour/pricing")>()),
  gtCancelTicket: gt.cancel,
  gtTicketDetails: gt.details,
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

async function gtTicket(roundTrip = false) {
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
  const back = roundTrip
    ? await prisma.trip.create({
        data: {
          fromCity: "Берлін",
          toCity: "Львів",
          departureTime: new Date("2026-12-10T18:00:00.000Z"),
          arrivalTime: new Date("2026-12-11T09:00:00.000Z"),
          price: 81,
          carrierId: carrier.id,
        },
      })
    : null;
  const ticket = await prisma.ticket.create({
    data: {
      userId: user.id,
      tripId: trip.id,
      ...(back ? { tripKind: "ROUND_TRIP" as const, returnTripId: back.id, returnSeatNumber: 7 } : {}),
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
    gt.details.mockResolvedValue({
      to: { key: "gt-1-1-160", seatNumber: 3, date: "2026-12-01", typeId: 55 },
      back: null,
      discountCard: null,
    });
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

  it("a paid ticket keeps the price it was paid at", async () => {
    const ticket = await gtTicket();
    await prisma.ticket.update({ where: { id: ticket.id }, data: { status: "PAID_CASH" } });
    expect(await change(ticket.id)).toEqual({ price: 81, oldPrice: 81 });
    const moved = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(moved).toMatchObject({ seatNumber: 12, carrierRef: "GT:700:800", finalPrice: 81, commissionAmount: 8.1 });
  });

  it("paid or not, tickets can be changed; cancelled ones not", () => {
    expect(gtChangeBlocked({ status: "RESERVED" })).toBeNull();
    expect(gtChangeBlocked({ status: "PAID_CASH" })).toBeNull();
    expect(gtChangeBlocked({ status: "CANCELLED" })).not.toBeNull();
  });

  describe("round trip (one GT ticket for both directions)", () => {
    const RETURN_TRIP = { ...NEW_TRIP, id: "gt-77-160-1", from: "Берлін", to: "Львів", departureAt: "2026-12-12T18:00:00.000Z", arrivalAt: "2026-12-13T09:00:00.000Z" };
    const original = {
      to: { key: "gt-1-1-160", seatNumber: 3, date: "2026-12-01", typeId: 55 },
      back: { key: "gt-2-160-1", seatNumber: 7, date: "2026-12-10", typeId: 55 },
      discountCard: "1234",
    };
    beforeEach(() => {
      gt.details.mockResolvedValue(original);
      gt.search.mockResolvedValue([RETURN_TRIP]);
    });
    const changeReturn = (ticketId: string) =>
      changeGtTicketTrip({ ticketId, leg: "return", tripKey: RETURN_TRIP.id, date: "2026-12-12", seatNumber: 9, changedBy: null, source: "ADMIN_PANEL" });

    it("cancels the old ticket first, then reserves the same outbound seat with the new return", async () => {
      const ticket = await gtTicket(true);
      await changeReturn(ticket.id);
      expect(gt.cancel).toHaveBeenCalledWith("GT:500:600");
      expect(gt.cancel.mock.invocationCallOrder[0]).toBeLessThan(gt.book.mock.invocationCallOrder[0]);
      const req = gt.book.mock.calls[0][0];
      expect(req).toMatchObject({ tripId: "gt-1-1-160", travelDate: "2026-12-01", returnTripId: RETURN_TRIP.id, returnDate: "2026-12-12", discountCard: "1234" });
      expect(req.passengers[0]).toMatchObject({ seatNumber: 3, returnSeatNumber: 9, fareTypeId: 55 });

      const moved = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id }, include: { returnTrip: true } });
      expect(moved).toMatchObject({ seatNumber: 3, returnSeatNumber: 9, carrierRef: "GT:700:800" });
      expect(moved.returnTrip?.departureTime.toISOString()).toBe(RETURN_TRIP.departureAt);
    });

    it("when GT refuses, the old round trip is reserved again", async () => {
      const ticket = await gtTicket(true);
      gt.book
        .mockRejectedValueOnce(new Error("Grandes Tour /api/v2/booking/reserve_tickets: місце зайняте"))
        .mockResolvedValueOnce({ carrierReference: "GT-701", status: "confirmed", tickets: [{ ref: "GT:701:801", price: 150, priceBeforeDiscount: 150, kind: "YOUTH" }] });
      await expect(changeReturn(ticket.id)).rejects.toThrow("Попередню бронь відновлено");
      expect(gt.book.mock.calls[1][0]).toMatchObject({ tripId: "gt-1-1-160", returnTripId: "gt-2-160-1" });
      expect(gt.book.mock.calls[1][0].passengers[0]).toMatchObject({ seatNumber: 3, returnSeatNumber: 7 });
      const same = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(same).toMatchObject({ returnSeatNumber: 7, carrierRef: "GT:701:801", finalPrice: 81 });
    });
  });
});
