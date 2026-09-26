import type { Role, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Report 9.2 — carrier report: every passenger booked on one carrier across
 * the whole site for a sales month, with totals (gross, agency commission,
 * carrier share) and an optional per-agent breakdown.
 *
 * Shared by the page (/cabinet/finance/carrier-report) and the CSV export
 * (/api/finance/carrier-report/csv) so both always show the same numbers.
 */

export type CarrierOption = { id: string; name: string; isOwnFleet: boolean };

export type CarrierReportTicket = {
  id: string;
  reference: string | null;
  passenger: string | null;
  route: string | null;
  departureTime: Date | null;
  bookedBy: string;
  bookedByRole: Role;
  status: TicketStatus;
  finalPrice: number;
  commissionAmount: number | null;
  carrierAmount: number | null;
};

export type CarrierReportAgentRow = {
  email: string;
  role: Role;
  count: number;
  gross: number;
  commission: number;
};

export type CarrierReport = {
  carriers: CarrierOption[];
  carrier: CarrierOption | null;
  period: string;
  tickets: CarrierReportTicket[];
  totals: { count: number; gross: number; commission: number; carrier: number };
  agentRows: CarrierReportAgentRow[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function currentPeriod(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

export async function getCarrierReport(input: {
  carrier?: string;
  period?: string;
}): Promise<CarrierReport> {
  const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(input.period ?? "")
    ? input.period!
    : currentPeriod();

  // Third-party carriers first, own fleet last (it has no commission split).
  const carriers = await prisma.carrier.findMany({
    select: { id: true, name: true, isOwnFleet: true },
    orderBy: [{ isOwnFleet: "asc" }, { name: "asc" }],
  });
  const carrier =
    carriers.find((c) => c.id === input.carrier) ?? carriers[0] ?? null;

  const start = new Date(`${period}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  const rows = carrier
    ? await prisma.ticket.findMany({
        where: {
          trip: { carrierId: carrier.id },
          createdAt: { gte: start, lt: end },
        },
        include: {
          booking: { select: { reference: true, firstName: true, lastName: true } },
          user: { select: { email: true, role: true } },
          trip: { select: { fromCity: true, toCity: true, departureTime: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 1000,
      })
    : [];

  const tickets: CarrierReportTicket[] = rows.map((t) => ({
    id: t.id,
    reference: t.booking?.reference ?? null,
    passenger: t.booking ? `${t.booking.firstName} ${t.booking.lastName}`.trim() : null,
    // A sold segment is reported by its own cities.
    route: t.trip
      ? `${t.fromCity ?? t.trip.fromCity} → ${t.toCity ?? t.trip.toCity}`
      : null,
    departureTime: t.trip?.departureTime ?? null,
    bookedBy: t.user.email,
    bookedByRole: t.user.role,
    status: t.status,
    finalPrice: t.finalPrice,
    commissionAmount: t.commissionAmount,
    carrierAmount: t.carrierAmount,
  }));

  const active = tickets.filter(
    (t) => t.status !== "CANCELLED" && t.status !== "REFUNDED"
  );
  const totals = {
    count: active.length,
    gross: round2(active.reduce((s, t) => s + t.finalPrice, 0)),
    commission: round2(active.reduce((s, t) => s + (t.commissionAmount ?? 0), 0)),
    carrier: round2(active.reduce((s, t) => s + (t.carrierAmount ?? 0), 0)),
  };

  const byAgent = new Map<string, CarrierReportAgentRow>();
  for (const t of active) {
    const entry = byAgent.get(t.bookedBy) ?? {
      email: t.bookedBy,
      role: t.bookedByRole,
      count: 0,
      gross: 0,
      commission: 0,
    };
    entry.count += 1;
    entry.gross = round2(entry.gross + t.finalPrice);
    entry.commission = round2(entry.commission + (t.commissionAmount ?? 0));
    byAgent.set(t.bookedBy, entry);
  }
  const agentRows = [...byAgent.values()].sort((a, b) => b.gross - a.gross);

  return { carriers, carrier, period, tickets, totals, agentRows };
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

/**
 * One CSV cell. `;`-separated with a UTF-8 BOM so Excel in Ukrainian / EU
 * locales opens Cyrillic correctly in separate columns. Cells that start
 * with = + - @ are prefixed with ' so a spreadsheet never evaluates
 * passenger-supplied text as a formula (CSV injection).
 */
function cell(value: string | number | null | undefined): string {
  if (value == null) return "";
  let s = typeof value === "number" ? value.toFixed(2) : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header: string[], rows: (string | number | null)[][]): string {
  const lines = [header, ...rows].map((r) => r.map(cell).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function carrierReportCsv(
  report: CarrierReport,
  kind: "tickets" | "agents",
  labels: { status: (s: TicketStatus) => string; role: (r: Role) => string }
): string {
  if (kind === "agents") {
    return toCsv(
      ["Агент", "Роль", "Квитків", "Сума бронювань, EUR", "Комісія, EUR"],
      report.agentRows.map((a) => [
        a.email,
        labels.role(a.role),
        String(a.count),
        a.gross,
        a.commission,
      ])
    );
  }
  return toCsv(
    [
      "Номер",
      "Пасажир",
      "Маршрут",
      "Виїзд (UTC)",
      "Оформив",
      "Ціна, EUR",
      "Комісія, EUR",
      "Перевізнику, EUR",
      "Статус",
    ],
    report.tickets.map((t) => [
      t.reference,
      t.passenger,
      t.route,
      t.departureTime ? t.departureTime.toISOString().slice(0, 16).replace("T", " ") : null,
      t.bookedBy,
      t.finalPrice,
      t.commissionAmount,
      t.carrierAmount,
      labels.status(t.status),
    ])
  );
}
