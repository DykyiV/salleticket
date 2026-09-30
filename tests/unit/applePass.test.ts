import { describe, expect, it } from "vitest";
import { applePassJson } from "@/lib/tickets/applePass";
import { solidPng } from "@/lib/tickets/solidPng";
import type { ETicketModel } from "@/lib/tickets/eTicket";

const ticket: ETicketModel = {
  reference: "AB-48860",
  issued: "30.09.2026, 19:21",
  passenger: "ШЕВЧЕНКО МАРІЯ",
  phones: "+380671112233",
  email: "pass-guest@example.com",
  category: "Дорослий",
  routeFrom: "Київ",
  routeTo: "Марбелья",
  depart: "01.10.2026, 08:00",
  arrive: "03.10.2026, 16:00",
  segments: [
    {
      order: 1,
      fromCity: "Київ",
      toCity: "Марбелья",
      fromDetail: "Петлюри",
      toDetail: "Марбелья",
      depart: "01.10.2026, 08:00",
      arrive: "03.10.2026, 16:00",
      bus: "Mercedes AA 1234 XX",
      seat: "місце 4",
    },
  ],
  layovers: [],
  price: "€49.50",
};

describe("apple wallet pass", () => {
  it("puts the route, seat and the check link into a bus boarding pass", () => {
    const pass = applePassJson(ticket, "http://localhost:3000/check/AB-48860");
    const boarding = pass.boardingPass as {
      transitType: string;
      primaryFields: { value: string }[];
      headerFields: { value: string }[];
    };
    expect(boarding.transitType).toBe("PKTransitTypeBus");
    expect(boarding.primaryFields.map((field) => field.value)).toEqual(["Київ", "Марбелья"]);
    expect(boarding.headerFields[0].value).toBe("4");
    expect(pass.barcode).toMatchObject({
      format: "PKBarcodeFormatQR",
      message: "http://localhost:3000/check/AB-48860",
    });
  });

  it("builds a png icon", () => {
    const png = solidPng(4, 4, [19, 73, 196]);
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });
});
