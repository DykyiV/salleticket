import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { uniqueReference } from "@/lib/tickets/reference";

async function clean() {
  await prisma.payment.deleteMany();
  await prisma.ticketHistory.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.carrier.deleteMany();
  await prisma.user.deleteMany();
}

async function makeBooking(reference: string) {
  const carrier = await prisma.carrier.create({
    data: { name: `C-${reference}` },
  });
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
    data: { email: `${reference}@test.local`, password: "x" },
  });
  const ticket = await prisma.ticket.create({
    data: {
      userId: user.id,
      tripId: trip.id,
      status: "RESERVED",
      basePrice: 99,
      finalPrice: 99,
    },
  });
  return prisma.booking.create({
    data: {
      reference,
      firstName: "Тест",
      lastName: "Тестовий",
      phone: "+380671234567",
      finalPrice: 99,
      ticketId: ticket.id,
    },
  });
}

describe("uniqueReference", () => {
  beforeEach(clean);

  it("never returns a reference that is already taken", async () => {
    await makeBooking("AB-00042");
    for (let i = 0; i < 10; i += 1) {
      const ref = await uniqueReference(prisma);
      expect(ref).toMatch(/^AB-\d{5}$/);
      expect(ref).not.toBe("AB-00042");
    }
  });

  it("is found by the digit part via contains search", async () => {
    await makeBooking("AB-30715");
    const found = await prisma.booking.findMany({
      where: { reference: { contains: "30715" } },
    });
    expect(found.map((b) => b.reference)).toContain("AB-30715");
  });
});
