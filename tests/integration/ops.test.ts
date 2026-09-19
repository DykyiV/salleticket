import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { coverSegment } from "@/lib/ops/coverage";
import { pickAssignment } from "@/lib/ops/legs";
import { swapAssignmentBus, SwapCapacityError } from "@/lib/ops/swap";
import type { CoachLayoutJSON } from "@/lib/seats";

function layoutWith(seats: number): string {
  const rows: CoachCell[][] = [];
  let left = seats;
  while (left > 0) {
    const row: CoachCell[] = [];
    for (let i = 0; i < 4 && left > 0; i += 1, left -= 1) row.push({ t: "seat" });
    rows.push(row);
  }
  return JSON.stringify({ decks: [{ name: "Салон", rows }] });
}
type CoachCell = { t: "seat" };

async function clean() {
  await prisma.seatZone.deleteMany();
  await prisma.ticketLeg.deleteMany();
  await prisma.vehicleAssignment.deleteMany();
  await prisma.leg.deleteMany();
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
  await prisma.transferPoint.deleteMany();
  await prisma.country.deleteMany();
  await prisma.carrier.deleteMany();
  await prisma.bus.deleteMany();
  await prisma.user.deleteMany();
}

async function makeOpsFixture() {
  const carrier = await prisma.carrier.create({ data: { name: "Ops Carrier" } });
  const ua = await prisma.country.create({ data: { name: "Україна", code: "UA" } });
  const de = await prisma.country.create({ data: { name: "Німеччина", code: "DE" } });
  const template = await prisma.routeTemplate.create({
    data: {
      countryId: de.id,
      originCountryId: ua.id,
      name: "Харків — Андернах",
      originCity: "Харків",
      destinationCity: "Андернах",
    },
  });
  const departure = await prisma.departure.create({
    data: {
      templateId: template.id,
      date: new Date("2026-10-06T00:00:00.000Z"),
      weekday: 2,
      stops: {
        create: [
          { sortOrder: 1, city: "Харків", outboundDay: 1, outboundTime: "06:00", returnDay: 3, returnTime: "23:00" },
          { sortOrder: 2, city: "Київ", outboundDay: 1, outboundTime: "11:00", returnDay: 3, returnTime: "18:00" },
          { sortOrder: 3, city: "Львів", outboundDay: 1, outboundTime: "18:00", returnDay: 2, returnTime: "14:00" },
          { sortOrder: 4, city: "Андернах", outboundDay: 2, outboundTime: "18:00", returnDay: 1, returnTime: "08:00" },
        ],
      },
      trips: {
        create: {
          fromCity: "Харків",
          toCity: "Андернах",
          departureTime: new Date("2026-10-06T06:00:00.000Z"),
          arrivalTime: new Date("2026-10-07T18:00:00.000Z"),
          price: 99,
          carrierId: carrier.id,
        },
      },
    },
    include: { stops: true, trips: true },
  });
  const [s1, , s3, s4] = departure.stops;
  const leg1 = await prisma.leg.create({
    data: { departureId: departure.id, order: 1, label: "UA плече", fromStopId: s1.id, toStopId: s3.id },
  });
  const leg2 = await prisma.leg.create({
    data: { departureId: departure.id, order: 2, label: "DE плече", fromStopId: s3.id, toStopId: s4.id },
  });
  await prisma.trip.update({
    where: { id: departure.trips[0].id },
    data: { legId: leg1.id },
  });
  const busA = await prisma.bus.create({
    data: { plate: "UA-02", layout: layoutWith(4) },
  });
  const busB = await prisma.bus.create({
    data: { plate: "DE-04", layout: layoutWith(4) },
  });
  const assignment1 = await prisma.vehicleAssignment.create({
    data: { legId: leg1.id, busId: busA.id },
  });
  const assignment2 = await prisma.vehicleAssignment.create({
    data: { legId: leg2.id, busId: busB.id },
  });
  return { departure, trip: departure.trips[0], leg1, leg2, busA, busB, assignment1, assignment2 };
}

async function bookOnAssignment(assignmentId: string, tripId: string, seat: number, toCity = "Андернах") {
  const user = await prisma.user.create({
    data: { email: `o${Math.random().toString(36).slice(2, 9)}@t.local`, password: "x" },
  });
  const ticket = await prisma.ticket.create({
    data: {
      userId: user.id,
      tripId,
      status: "RESERVED",
      basePrice: 40,
      finalPrice: 40,
      seatNumber: seat,
      assignmentId,
      toCity,
      booking: {
        create: {
          reference: `AB-${Math.floor(Math.random() * 100000).toString().padStart(5, "0")}`,
          firstName: "Тест",
          lastName: "Опс",
          phone: "+380671234567",
          finalPrice: 40,
        },
      },
    },
  });
  await prisma.ticketLeg.create({
    data: { ticketId: ticket.id, order: 1, tripId, assignmentId, seatNumber: seat },
  });
  return ticket;
}

describe("bus swap", () => {
  beforeEach(clean);

  it("allows swap when new capacity covers booked passengers and keeps seats", async () => {
    const { assignment1 } = await makeOpsFixture();
    await bookOnAssignment(assignment1.id, (await prisma.trip.findFirst())!.id, 1);
    await bookOnAssignment(assignment1.id, (await prisma.trip.findFirst())!.id, 2);
    const bigger = await prisma.bus.create({
      data: { plate: "UA-59", layout: layoutWith(6) },
    });
    const result = await swapAssignmentBus({
      assignmentId: assignment1.id,
      newBusId: bigger.id,
      changedBy: null,
    });
    expect(result.kept).toBe(2);
    expect(result.remapped).toHaveLength(0);
  });

  it("blocks swap when the new bus is smaller than the booked count", async () => {
    const { assignment1 } = await makeOpsFixture();
    const tripId = (await prisma.trip.findFirst())!.id;
    for (const seat of [1, 2, 3, 4]) {
      await bookOnAssignment(assignment1.id, tripId, seat);
    }
    const smaller = await prisma.bus.create({
      data: { plate: "UA-40", layout: layoutWith(3) },
    });
    await expect(
      swapAssignmentBus({ assignmentId: assignment1.id, newBusId: smaller.id, changedBy: null })
    ).rejects.toBeInstanceOf(SwapCapacityError);
  });

  it("remaps seats that do not exist in the new layout", async () => {
    const { assignment1 } = await makeOpsFixture();
    const tripId = (await prisma.trip.findFirst())!.id;
    await bookOnAssignment(assignment1.id, tripId, 4); // exists only in the 4-seat bus
    const threeSeat = await prisma.bus.create({
      data: { plate: "UA-03", layout: layoutWith(3) },
    });
    const result = await swapAssignmentBus({
      assignmentId: assignment1.id,
      newBusId: threeSeat.id,
      changedBy: null,
    });
    expect(result.remapped).toHaveLength(1);
    expect(result.remapped[0].from).toBe(4);
    expect(result.remapped[0].to).toBeGreaterThan(0);
  });
});

describe("leg coverage (transfer + direct)", () => {
  beforeEach(clean);

  it("splits a cross-leg sale into two legs with a transfer city", async () => {
    const { trip } = await makeOpsFixture();
    const coverage = await coverSegment({
      tripId: trip.id,
      fromIndex: 0,
      toIndex: 3,
      destinationLabel: "Андернах",
    });
    expect(coverage.legs).toHaveLength(2);
    expect(coverage.transferCity).toBe("Львів");
    expect(coverage.legs[0].assignment?.busPlate).toBe("UA-02");
    expect(coverage.legs[1].assignment?.busPlate).toBe("DE-04");
  });

  it("direct assignment keeps the whole sale on one bus", async () => {
    const { trip, assignment1 } = await makeOpsFixture();
    await prisma.vehicleAssignment.update({
      where: { id: assignment1.id },
      data: { isDirect: true, directDestinationCity: "Андернах" },
    });
    const coverage = await coverSegment({
      tripId: trip.id,
      fromIndex: 0,
      toIndex: 3,
      destinationLabel: "Андернах",
    });
    expect(coverage.legs).toHaveLength(1);
    expect(coverage.transferCity).toBeNull();
    expect(coverage.legs[0].assignment?.isDirect).toBe(true);
  });

  it("spills into the second bus when the first is full", async () => {
    const { leg1, assignment1 } = await makeOpsFixture();
    const tripId = (await prisma.trip.findFirst())!.id;
    for (const seat of [1, 2, 3, 4]) {
      await bookOnAssignment(assignment1.id, tripId, seat);
    }
    const busC = await prisma.bus.create({
      data: { plate: "UA-99", layout: layoutWith(4) },
    });
    const assignment2 = await prisma.vehicleAssignment.create({
      data: { legId: leg1.id, busId: busC.id },
    });
    const picked = await pickAssignment({
      db: prisma,
      legId: leg1.id,
      seatNumber: 1,
    });
    expect(picked?.id).toBe(assignment2.id);
  });
});
