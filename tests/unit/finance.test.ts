import { describe, expect, it } from "vitest";
import { computeSplit, SELLABLE_STATUSES } from "@/lib/settlements";
import { carrierReportCsv, type CarrierReport } from "@/lib/finance/carrierReport";

describe("computeSplit — payment point decides who owes whom", () => {
  it("online sales: we collected, we owe the carrier its share", () => {
    const s = computeSplit([
      { status: "PAID_ONLINE", finalPrice: 100, commissionAmount: 12, carrierAmount: 88 },
    ]);
    expect(s.collectedByAgent).toBe(100);
    expect(s.balanceAmount).toBe(88);
    expect(s.balanceDirection).toBe("TO_CARRIER");
  });

  it("cash sales: carrier collected, it owes us the commission", () => {
    const s = computeSplit([
      { status: "PAID_CASH", finalPrice: 100, commissionAmount: 12, carrierAmount: 88 },
    ]);
    expect(s.collectedByCarrier).toBe(100);
    expect(s.balanceAmount).toBe(12);
    expect(s.balanceDirection).toBe("TO_AGENT");
  });

  it("AWAITING_PAYMENT (f005's open online window) counts as unpaid, like RESERVED", () => {
    expect(SELLABLE_STATUSES).toContain("AWAITING_PAYMENT");
    const s = computeSplit([
      { status: "AWAITING_PAYMENT", finalPrice: 94.05, commissionAmount: 9.41, carrierAmount: 84.64 },
      { status: "RESERVED", finalPrice: 50, commissionAmount: 5, carrierAmount: 45 },
    ]);
    expect(s.unpaidAmount).toBe(144.05);
    expect(s.balanceAmount).toBe(0);
    expect(s.balanceDirection).toBe("ZERO");
  });

  it("nets online vs cash", () => {
    const s = computeSplit([
      { status: "PAID_ONLINE", finalPrice: 100, commissionAmount: 10, carrierAmount: 90 },
      { status: "PAID_CASH", finalPrice: 200, commissionAmount: 20, carrierAmount: 180 },
    ]);
    expect(s.balanceAmount).toBe(70); // 90 owed to carrier − 20 owed to us
    expect(s.balanceDirection).toBe("TO_CARRIER");
  });
});

describe("carrier report CSV", () => {
  const report: CarrierReport = {
    carriers: [{ id: "c1", name: "Grandes Tour", isOwnFleet: false }],
    carrier: { id: "c1", name: "Grandes Tour", isOwnFleet: false },
    period: "2026-09",
    tickets: [
      {
        id: "t1",
        reference: "AB-12345",
        passenger: 'Шевченко "Кобзар"; Тарас',
        route: "Київ → Берлін",
        departureTime: new Date("2026-09-20T08:00:00.000Z"),
        bookedBy: "agent@asolbus.local",
        bookedByRole: "AGENT",
        status: "PAID_ONLINE",
        finalPrice: 94.05,
        commissionAmount: 11.29,
        carrierAmount: 82.76,
      },
      {
        id: "t2",
        reference: "AB-12346",
        passenger: "=HYPERLINK(\"http://evil\")",
        route: "Київ → Берлін",
        departureTime: null,
        bookedBy: "x@y.z",
        bookedByRole: "CUSTOMER",
        status: "RESERVED",
        finalPrice: 99,
        commissionAmount: null,
        carrierAmount: null,
      },
    ],
    totals: { count: 2, gross: 193.05, commission: 11.29, carrier: 82.76 },
    agentRows: [{ email: "agent@asolbus.local", role: "AGENT", count: 1, gross: 94.05, commission: 11.29 }],
  };
  const labels = { status: (s: string) => `S:${s}`, role: (r: string) => `R:${r}` };

  it("starts with a UTF-8 BOM and uses ; with CRLF (Excel in UA/EU locales)", () => {
    const csv = carrierReportCsv(report, "tickets", labels);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("\r\n");
    expect(csv.split("\r\n")[0]).toBe(
      "﻿Номер;Пасажир;Маршрут;Виїзд (UTC);Оформив;Ціна, EUR;Комісія, EUR;Перевізнику, EUR;Статус"
    );
  });

  it("quotes cells containing ; or quotes and doubles embedded quotes", () => {
    const csv = carrierReportCsv(report, "tickets", labels);
    expect(csv).toContain('"Шевченко ""Кобзар""; Тарас"');
    expect(csv).toContain("94.05;11.29;82.76;S:PAID_ONLINE");
  });

  it("neutralises formula injection from passenger-supplied text", () => {
    const csv = carrierReportCsv(report, "tickets", labels);
    expect(csv).not.toMatch(/;=HYPERLINK/);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
  });

  it("exports the per-agent breakdown", () => {
    const csv = carrierReportCsv(report, "agents", labels);
    const [header, row] = csv.replace("﻿", "").split("\r\n");
    expect(header).toBe("Агент;Роль;Квитків;Сума бронювань, EUR;Комісія, EUR");
    expect(row).toBe("agent@asolbus.local;R:AGENT;1;94.05;11.29");
  });
});
