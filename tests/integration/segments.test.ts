import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  FULL_ROUTE,
  findSegmentTrips,
  resolveSegment,
  segmentsOverlap,
} from "@/lib/trips/segments";
import {
  assertSeatAvailable,
  occupiedSeatNumbers,
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

async function makeRouteWithStops() {
  const carrier = await prisma.carrier.create({ data: { name: "Seg Carrier" } });
  const ua = await prisma.country.create({ data: { name: "Україна", code: "UA" } });
  const de = await prisma.country.create({ data: { name: "Німеччина", code: "DE" } });
  const template = await prisma.routeTemplate.create({
    data: {
      countryId: de.id,
      originCountryId: ua.id,
      name: "Київ — Берлін",
      originCity: "Київ",
      destinationCity: "Берлін",
    },
  });
  const departure = await prisma.departure.create({
    data: {
      templateId: template.id,
      date: new Date("2026-10-06T00:00:00.000Z"),
      weekday: 2,
      stops: {
        create: [
          { sortOrder: 1, city: "Київ", outboundDay: 1, outboundTime: "07:00", returnDay: 2, returnTime: "18:00" },
          { sortOrder: 2, city: "Львів", outboundDay: 1, outboundTime: "15:00", returnDay: 2, returnTime: "12:00" },
          { sortOrder: 3, city: "Варшава", outboundDay: 1, outboundTime: "22:00", returnDay: 2, returnTime: "08:00" },
          { sortOrder: 4, city: "Берлін", outboundDay: 2, outboundTime: "06:00", returnDay: 1, returnTime: "20:00" },
        ],
      },
      trips: {
        create: [
          {
            fromCity: "Київ",
            toCity: "Берлін",
            departureTime: new Date("2026-10-06T07:00:00.000Z"),
            arrivalTime: new Date("2026-10-07T06:00:00.000Z"),
            price: 99,
            carrierId: carrier.id,
          },
          {
            fromCity: "Берлін",
            toCity: "Київ",
            departureTime: new Date("2026-10-06T20:00:00.000Z"),
            arrivalTime: new Date("2026-10-07T18:00:00.000Z"),
            price: 99,
            carrierId: carrier.id,
          },
        ],
      },
    },
    include: { trips: true },
  });
  return { departure, trip: departure.trips.find((t) => t.fromCity === "Київ")! };
}

async function bookSeat(tripId: string, seat: number, segment?: { fromIndex: number; toIndex: number }) {
  const user = await prisma.user.create({
    data: { email: `s${Math.random().toString(36).slice(2, 9)}@t.local`, password: "x" },
  });
  return prisma.ticket.create({
    data: {
      userId: user.id,
      tripId,
      status: "RESERVED",
      basePrice: 40,
      finalPrice: 40,
      seatNumber: seat,
      fromStopIndex: segment?.fromIndex ?? null,
      toStopIndex: segment?.toIndex ?? null,
    },
  });
}

describe("segmentsOverlap", () => {
  it("overlaps only when legs share a section", () => {
    expect(segmentsOverlap({ fromIndex: 0, toIndex: 2 }, { fromIndex: 1, toIndex: 3 })).toBe(true);
    expect(segmentsOverlap({ fromIndex: 0, toIndex: 2 }, { fromIndex: 2, toIndex: 4 })).toBe(false);
    expect(segmentsOverlap(FULL_ROUTE, { fromIndex: 1, toIndex: 2 })).toBe(true);
  });
});

describe("segment seat inventory", () => {
  beforeEach(clean);

  it("finds trips for stop-to-stop segments", async () => {
    await makeRouteWithStops();
    const options = await findSegmentTrips({
      fromCity: "Львів",
      toCity: "Берлін",
      date: "2026-10-06",
    });
    expect(options.length).toBeGreaterThan(0);
    expect(options[0].fromCity).toBe("Львів");
    expect(options[0].toCity).toBe("Берлін");
  });

  it("resolves cities to stop indices per direction", async () => {
    const { trip } = await makeRouteWithStops();
    const seg = await resolveSegment(prisma, trip.id, "Львів", "Берлін");
    expect(seg).toEqual({ fromIndex: 1, toIndex: 3 });
    expect(await resolveSegment(prisma, trip.id, "Берлін", "Львів")).toBeNull();
  });

  it("resells the same seat on non-overlapping legs and blocks overlapping ones", async () => {
    const { trip } = await makeRouteWithStops();
    // Seat 15: Київ → Львів (segment 0–2)
    await bookSeat(trip.id, 15, { fromIndex: 0, toIndex: 2 });

    // Львів → Берлін (2–4): free — no overlap
    await expect(
      assertSeatAvailable(prisma, trip.id, 15, undefined, undefined, {
        fromIndex: 2,
        toIndex: 4,
      })
    ).resolves.toBe(15);

    // Київ → Варшава (0–3): overlaps → taken
    await expect(
      assertSeatAvailable(prisma, trip.id, 15, undefined, undefined, {
        fromIndex: 0,
        toIndex: 3,
      })
    ).rejects.toBeInstanceOf(SeatTakenError);

    const fullRouteTaken = await occupiedSeatNumbers(prisma, trip.id);
    expect(fullRouteTaken.has(15)).toBe(true);
    const secondLegFree = await occupiedSeatNumbers(prisma, trip.id, undefined, {
      fromIndex: 2,
      toIndex: 4,
    });
    expect(secondLegFree.has(15)).toBe(false);
  });

  it("a full-route ticket blocks the seat on every leg", async () => {
    const { trip } = await makeRouteWithStops();
    await bookSeat(trip.id, 20);
    await expect(
      assertSeatAvailable(prisma, trip.id, 20, undefined, undefined, {
        fromIndex: 2,
        toIndex: 4,
      })
    ).rejects.toBeInstanceOf(SeatTakenError);
  });
});
