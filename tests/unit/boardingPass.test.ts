import { describe, expect, it } from "vitest";
import { toBoardingPass } from "@/lib/tickets/boardingPass";

describe("toBoardingPass", () => {
  it("includes departure, arrival, boarding coordinates and bus phones", () => {
    const pass = toBoardingPass({
      reference: "AB-10001",
      firstName: "Марія",
      lastName: "Шевченко",
      phone: "+380671112233",
      phone2: "+380501112233",
      phone3: "",
      ticket: {
        seatNumber: 12,
        trip: {
          fromCity: "Київ",
          toCity: "Берлін",
          departureTime: new Date("2026-10-15T03:30:00.000Z"),
          arrivalTime: new Date("2026-10-15T10:45:00.000Z"),
          departure: {
            defaultBus: "Van Hool",
            busPhone: "+380671110000",
            dispatcherPhone: "+380501110000",
            bus: { plate: "AA1234BB", model: "Van Hool" },
            stops: [
              {
                city: "Київ",
                boardingAddress: "Автостанція, вул. С. Петлюри, 32",
                latitude: 50.4408,
                longitude: 30.4889,
                outboundTime: "06:30",
              },
            ],
          },
        },
      },
    });

    expect(pass.passengerName).toBe("Марія Шевченко");
    expect(pass.phones).toEqual(["+380671112233", "+380501112233"]);
    expect(pass.departureLabel).toContain("06:30");
    expect(pass.arrivalLabel).toContain("13:45");
    expect(pass.boardingPlace).toContain("Петлюри");
    expect(pass.coordinates).toBe("50.44080, 30.48890");
    expect(pass.mapsUrl).toContain("50.4408,30.4889");
    expect(pass.busNumber).toBe("AA1234BB");
    expect(pass.busPhone).toBe("+380671110000");
    expect(pass.dispatcherPhone).toBe("+380501110000");
    expect(pass.seatLabel).toBe("12");
  });
});
