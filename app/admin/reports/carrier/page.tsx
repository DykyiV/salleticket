import Link from "next/link";
import { Suspense } from "react";
import Header from "@/components/Header";
import AgentBreakdownToggle from "@/components/admin/AgentBreakdownToggle";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const eur = (n: number) => `€${n.toFixed(2)}`;

const STATUS_STYLES: Record<string, string> = {
  RESERVED: "bg-amber-50 text-amber-700 ring-amber-200",
  PAID_ONLINE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PAID_CASH: "bg-sky-50 text-sky-700 ring-sky-200",
  CANCELLED: "bg-rose-50 text-rose-700 ring-rose-200",
  REFUNDED: "bg-slate-100 text-slate-600 ring-slate-200",
};

/**
 * Report 9.2 — carrier report: every passenger booked on this carrier across
 * the whole site for a sales month, with totals (gross, agency commission,
 * carrier share). The «розбити по агентах» checkbox adds a per-agent
 * breakdown: who booked what amount and the commission on their sales.
 */
export default async function CarrierReportPage(
  props: {
    searchParams: Promise<{ carrier?: string; period?: string; group?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const now = new Date();
  const defaultPeriod = now.toISOString().slice(0, 7); // current month YYYY-MM
  const period = /^\d{4}-\d{2}$/.test(searchParams.period ?? "")
    ? searchParams.period!
    : defaultPeriod;
  const groupByAgent = searchParams.group === "agents";

  const carriers = await prisma.carrier.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const carrierId = carriers.some((c) => c.id === searchParams.carrier)
    ? searchParams.carrier!
    : (carriers[0]?.id ?? "");
  const carrier = carriers.find((c) => c.id === carrierId);

  const periodStart = new Date(`${period}-01T00:00:00.000Z`);
  const periodEnd = new Date(periodStart);
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

  const tickets = carrierId
    ? await prisma.ticket.findMany({
        where: {
          trip: { carrierId },
          createdAt: { gte: periodStart, lt: periodEnd },
        },
        include: {
          booking: true,
          user: { select: { email: true, role: true } },
          trip: { select: { fromCity: true, toCity: true, departureTime: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 1000,
      })
    : [];

  const active = tickets.filter(
    (t) => t.status !== "CANCELLED" && t.status !== "REFUNDED"
  );
  const totals = {
    count: active.length,
    gross: active.reduce((s, t) => s + t.finalPrice, 0),
    commission: active.reduce((s, t) => s + (t.commissionAmount ?? 0), 0),
    carrier: active.reduce((s, t) => s + (t.carrierAmount ?? 0), 0),
  };

  // Per-agent breakdown (who booked, on what amount, which commission).
  const byAgent = new Map<
    string,
    { email: string; role: string; count: number; gross: number; commission: number }
  >();
  for (const t of active) {
    const key = t.user.email;
    const entry =
      byAgent.get(key) ??
      { email: t.user.email, role: t.user.role, count: 0, gross: 0, commission: 0 };
    entry.count += 1;
    entry.gross += t.finalPrice;
    entry.commission += t.commissionAmount ?? 0;
    byAgent.set(key, entry);
  }
  const agentRows = [...byAgent.values()].sort((a, b) => b.gross - a.gross);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Link
            href="/admin/reports"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            ← Звіти
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            Звіт для перевізника
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Усі пасажири перевізника з усього сайту за місяць продажів.
          </p>

          <form
            method="GET"
            action="/admin/reports/carrier"
            className="mt-5 flex flex-wrap items-center gap-2"
          >
            <select
              name="carrier"
              defaultValue={carrierId}
              className="rounded-xl border-0 bg-white px-3.5 py-2 text-sm text-slate-700 ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-500"
            >
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="month"
              name="period"
              defaultValue={period}
              className="rounded-xl border-0 bg-white px-3.5 py-2 text-sm text-slate-700 ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-500"
            />
            {groupByAgent ? <input type="hidden" name="group" value="agents" /> : null}
            <button
              type="submit"
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Показати
            </button>
            <Suspense>
              <AgentBreakdownToggle checked={groupByAgent} />
            </Suspense>
          </form>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Пасажирів" value={String(totals.count)} />
            <Stat label="Оборот" value={eur(totals.gross)} />
            <Stat label="Комісія агенства" value={eur(totals.commission)} />
            <Stat label="Частка перевізника" value={eur(totals.carrier)} />
          </div>

          {groupByAgent ? (
            <section className="mt-6 overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
              <h2 className="border-b border-slate-100 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-900">
                Розбивка по агентах
              </h2>
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Агент</Th>
                    <Th>Роль</Th>
                    <Th className="text-right">Квитків</Th>
                    <Th className="text-right">Сума бронювань</Th>
                    <Th className="text-right">Комісія</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {agentRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                        Немає продажів за цей період.
                      </td>
                    </tr>
                  ) : (
                    agentRows.map((a) => (
                      <tr key={a.email} className="transition hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{a.email}</td>
                        <td className="px-4 py-3 text-slate-500">{a.role}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                          {a.count}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                          {eur(a.gross)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                          {eur(a.commission)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          ) : null}

          <section className="mt-6 overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
            <h2 className="border-b border-slate-100 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-900">
              Пасажири {carrier?.name ?? ""} · {period}
            </h2>
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Референс</Th>
                  <Th>Пасажир</Th>
                  <Th>Маршрут</Th>
                  <Th>Виїзд</Th>
                  <Th>Оформив</Th>
                  <Th className="text-right">Ціна</Th>
                  <Th className="text-right">Комісія</Th>
                  <Th className="text-right">Перевізнику</Th>
                  <Th>Статус</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                      Немає квитків за цей період.
                    </td>
                  </tr>
                ) : (
                  tickets.map((t) => (
                    <tr key={t.id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/tickets/${t.id}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {t.booking?.reference ?? t.id.slice(-8)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {t.booking ? `${t.booking.firstName} ${t.booking.lastName}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {t.trip ? `${t.trip.fromCity} → ${t.trip.toCity}` : "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">
                        {t.trip
                          ? t.trip.departureTime.toISOString().slice(0, 16).replace("T", " ")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{t.user.email}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                        {eur(t.finalPrice)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {t.commissionAmount != null ? eur(t.commissionAmount) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {t.carrierAmount != null ? eur(t.carrierAmount) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                            STATUS_STYLES[t.status]
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${className}`}
    >
      {children}
    </th>
  );
}
