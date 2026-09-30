import { describe, expect, it } from "vitest";
import { buildETicket } from "@/lib/tickets/eTicket";

describe("buildETicket", () => {
  it("shows the whole route and each bus change with its seat", () => {
    const ticket = buildETicket({
      reference: "AB-20002",
      firstName: "Марія",
      lastName: "Шевченко",
      phone: "+380671112233",
      email: "m@example.com",
      ageCategory: "ADULT",
      finalPrice: 80,
      createdAt: new Date("2026-09-01T10:00:00.000Z"),
      ticket: {
        seatNumber: 4,
        trip: {
          fromCity: "Київ",
          toCity: "Мадрид",
          departureTime: new Date("2026-10-01T05:00:00.000Z"),
          arrivalTime: new Date("2026-10-03T16:00:00.000Z"),
          departure: {
            date: new Date("2026-10-01T00:00:00.000Z"),
            stops: [
              { city: "Київ", outboundDay: 1, outboundTime: "08:00", boardingAddress: "Петлюри, 32" },
              { city: "Львів", outboundDay: 1, outboundTime: "15:00", boardingAddress: "Стрийська" },
              { city: "Мадрид", outboundDay: 3, outboundTime: "19:00", boardingAddress: "Méndez Álvaro" },
            ],
          },
        },
        legs: [
          {
            order: 1,
            fromCity: "Київ",
            toCity: "Львів",
            seatNumber: 4,
            assignment: { bus: { model: "Mercedes", plate: "AA1111" }, leg: { transferMinutes: null } },
          },
          {
            order: 2,
            fromCity: "Львів",
            toCity: "Мадрид",
            seatNumber: 12,
            assignment: { bus: { model: "Van Hool", plate: "BB2222" }, leg: { transferMinutes: 30 } },
          },
        ],
      },
    });

    expect(ticket.routeFrom).toBe("Київ");
    expect(ticket.routeTo).toBe("Мадрид");
    expect(ticket.segments).toHaveLength(2);
    expect(ticket.segments[0].bus).toContain("AA1111");
    expect(ticket.segments[0].seat).toBe("місце 4");
    expect(ticket.segments[0].depart).toContain("08:00");
    expect(ticket.segments[1].seat).toBe("місце 12");
    expect(ticket.segments[1].arrive).toContain("19:00");
    expect(ticket.layovers).toEqual([{ city: "Львів", minutes: 30 }]);
    expect(ticket.passenger).toBe("ШЕВЧЕНКО МАРІЯ");
  });
});
