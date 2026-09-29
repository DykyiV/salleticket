import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  assertSeatAvailable,
  getTripSeatLayout,
  heldSeatNumbers,
  occupiedSeatNumbers,
  SeatHeldError,
  SeatRequiredError,
  SeatTakenError,
} from "@/lib/tickets/inventory";

async function clean() {
  await prisma.seatHold.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.ticketHistory.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.departureStop.deleteMany();
  await prisma.departure.deleteMany();
  await prisma.routeTemplateStop.deleteMany();
  await prisma.routeTemplate.deleteMany();
  await prisma.country.deleteMany();
  await prisma.carrier.deleteMany();
  await prisma.user.deleteMany();
}

async function makeTrip(options?: { withDeparture?: boolean }) {
  const carrier = await prisma.carrier.create({ data: { name: "Test Carrier" } });
  let departureId: string | undefined;
  if (options?.withDeparture) {
    const country = await prisma.country.create({ data: { name: "Україна" } });
    const template = await prisma.routeTemplate.create({
      data: {
        countryId: country.id,
        name: "Київ — Берлін",
        originCity: "Київ",
        destinationCity: "Берлін",
      },
    });
    const departure = await prisma.departure.create({
      data: {
        templateId: template.id,
        date: new Date("2026-10-01T00:00:00.000Z"),
        weekday: 4,
      },
    });
    departureId = departure.id;
  }
  const trip = await prisma.trip.create({
    data: {
      fromCity: "Київ",
      toCity: "Берлін",
      departureTime: new Date("2026-10-01T08:00:00.000Z"),
      arrivalTime: new Date("2026-10-02T06:00:00.000Z"),
      price: 99,
      carrierId: carrier.id,
      departureId,
    },
  });
  return { carrier, trip, departureId };
}

async function makeUser() {
  return prisma.user.create({
    data: {
      email: `u${Math.random().toString(36).slice(2, 8)}@test.local`,
      password: "x",
    },
  });
}

describe("seat inventory", () => {
  beforeEach(clean);

  it("counts active tickets as occupied and ignores cancelled ones", async () => {
    const { trip } = await makeTrip();
    const user = await makeUser();
    await prisma.ticket.create({
      data: {
        userId: user.id,
        tripId: trip.id,
        status: "RESERVED",
        basePrice: 99,
        finalPrice: 99,
        seatNumber: 5,
      },
    });
    await prisma.ticket.create({
      data: {
        userId: user.id,
        tripId: trip.id,
        status: "CANCELLED",
        basePrice: 99,
        finalPrice: 99,
        seatNumber: 6,
      },
    });

    const taken = await occupiedSeatNumbers(prisma, trip.id);
    expect(taken.has(5)).toBe(true);
    expect(taken.has(6)).toBe(false);
  });

  it("shares the coach between outbound and return trips of one departure", async () => {
    const { trip, departureId } = await makeTrip({ withDeparture: true });
    const returnTrip = await prisma.trip.create({
      data: {
        fromCity: "Берлін",
        toCity: "Київ",
        departureTime: new Date("2026-10-03T08:00:00.000Z"),
        arrivalTime: new Date("2026-10-04T06:00:00.000Z"),
        price: 99,
        carrierId: trip.carrierId,
        departureId,
      },
    });
    const user = await makeUser();
    await prisma.ticket.create({
      data: {
        userId: user.id,
        tripId: trip.id,
        status: "PAID_ONLINE",
        basePrice: 99,
        finalPrice: 99,
        seatNumber: 9,
      },
    });

    // Outbound seat is taken on the outbound coach…
    expect((await occupiedSeatNumbers(prisma, trip.id)).has(9)).toBe(true);
    // …but the return coach is a separate run — seat 9 is free there.
    expect((await occupiedSeatNumbers(prisma, returnTrip.id)).has(9)).toBe(false);
  });

  it("holds lock a seat for other sessions only until they expire", async () => {
    const { trip } = await makeTrip();
    await prisma.seatHold.create({
      data: {
        tripId: trip.id,
        seatNumber: 12,
        sessionId: "session-a",
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });
    await prisma.seatHold.create({
      data: {
        tripId: trip.id,
        seatNumber: 13,
        sessionId: "session-a",
        expiresAt: new Date(Date.now() - 60_000), // expired
      },
    });

    const forB = await heldSeatNumbers(prisma, trip.id, "session-b");
    expect(forB.has(12)).toBe(true);
    expect(forB.has(13)).toBe(false);

    const forA = await heldSeatNumbers(prisma, trip.id, "session-a");
    expect(forA.has(12)).toBe(false);
  });

  it("assertSeatAvailable rejects taken, held and missing seats", async () => {
    const { trip } = await makeTrip();
    const user = await makeUser();
    await prisma.ticket.create({
      data: {
        userId: user.id,
        tripId: trip.id,
        status: "PAID_CASH",
        basePrice: 99,
        finalPrice: 99,
        seatNumber: 3,
      },
    });
    await prisma.seatHold.create({
      data: {
        tripId: trip.id,
        seatNumber: 4,
        sessionId: "someone-else",
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });

    await expect(assertSeatAvailable(prisma, trip.id, 3)).rejects.toBeInstanceOf(
      SeatTakenError
    );
    await expect(
      assertSeatAvailable(prisma, trip.id, 4, undefined, "my-session")
    ).rejects.toBeInstanceOf(SeatHeldError);
    await expect(assertSeatAvailable(prisma, trip.id, null)).rejects.toBeInstanceOf(
      SeatRequiredError
    );
    // The holder may use their own held seat.
    await expect(
      assertSeatAvailable(prisma, trip.id, 4, undefined, "someone-else")
    ).resolves.toBe(4);
    await expect(assertSeatAvailable(prisma, trip.id, 10)).resolves.toBe(10);
  });

  it("returns an empty layout for departures without assigned seats", async () => {
    const { trip, departureId } = await makeTrip({ withDeparture: true });
    await prisma.departure.update({
      where: { id: departureId! },
      data: { hasAssignedSeats: false },
    });
    const layout = await getTripSeatLayout(prisma, trip.id);
    expect(layout.hasAssignedSeats).toBe(false);
    expect(layout.seats).toHaveLength(0);
    await expect(assertSeatAvailable(prisma, trip.id, null)).resolves.toBeNull();
  });
});
