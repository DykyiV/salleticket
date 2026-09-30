import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { claimGuestTickets, ensureGuestHolder, GUEST_EMAIL } from "@/lib/auth/guest";

async function clean() {
  await prisma.ticketHistory.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.carrier.deleteMany();
  await prisma.user.deleteMany();
}

describe("claimGuestTickets", () => {
  beforeEach(clean);

  it("moves only this browser's guest tickets onto the account that signs in", async () => {
    const guest = await ensureGuestHolder();
    const carrier = await prisma.carrier.create({ data: { name: "Guest Carrier" } });
    const trip = await prisma.trip.create({
      data: {
        fromCity: "Київ",
        toCity: "Берлін",
        departureTime: new Date("2026-10-01T08:00:00.000Z"),
        arrivalTime: new Date("2026-10-02T06:00:00.000Z"),
        price: 80,
        carrierId: carrier.id,
      },
    });
    const token = "browser-token";
    const ticket = await prisma.ticket.create({
      data: {
        userId: guest.id,
        guestClaim: token,
        tripId: trip.id,
        status: "RESERVED",
        basePrice: 80,
        finalPrice: 80,
      },
    });
    await prisma.ticket.create({
      data: {
        userId: guest.id,
        guestClaim: "someone-else",
        tripId: trip.id,
        status: "RESERVED",
        basePrice: 40,
        finalPrice: 40,
      },
    });
    const user = await prisma.user.create({
      data: { email: "new@asolbus.local", password: "x", role: "CUSTOMER" },
    });

    expect(await claimGuestTickets(user.id, token)).toBe(1);
    const claimed = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(claimed?.userId).toBe(user.id);
    expect(claimed?.guestClaim).toBeNull();

    const other = await prisma.ticket.findFirst({ where: { guestClaim: "someone-else" } });
    expect(other?.userId).toBe(guest.id);
    expect(await claimGuestTickets(user.id, token)).toBe(0);
    expect(guest.email).toBe(GUEST_EMAIL);
  });
});
