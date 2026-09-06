import Link from "next/link";
import Header from "@/components/Header";
import ExportCsvButton from "@/components/admin/ExportCsvButton";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type SearchParams = {
  agentId?: string;
  dateFrom?: string;
  dateTo?: string;
};

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function money(n: number): string {
  return `€${n.toFixed(2)}`;
}

const PAYMENT_LABELS: Record<string, string> = {
  ONLINE: "Онлайн",
  CASH_TO_AGENT: "Готівка агенту",
  CASH_TO_CARRIER: "Готівка перевізнику",
};

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30);

  const dateFrom = searchParams.dateFrom
    ? new Date(`${searchParams.dateFrom}T00:00:00.000Z`)
    : defaultFrom;
  const dateTo = searchParams.dateTo
    ? new Date(`${searchParams.dateTo}T23:59:59.999Z`)
    : now;
  const agentId = searchParams.agentId || "";

  const agents = await prisma.user.findMany({
    where: { role: { in: ["AGENT", "ADMIN", "SUPER_ADMIN"] } },
    select: { id: true, email: true, role: true },
    orderBy: { email: "asc" },
  });

  // All tickets in range — the base dataset for both the route breakdown
  // (every channel) and the system-wide revenue/payment-method summary.
  const allTickets = await prisma.ticket.findMany({
    where: { createdAt: { gte: dateFrom, lte: dateTo } },
    select: {
      id: true,
      finalPrice: true,
      commissionAmount: true,
      paymentMethod: true,
      bookedByUserId: true,
      bookedBy: { select: { email: true } },
      trip: { select: { fromCity: true, toCity: true } },
    },
  });

  // Agent breakdown: only staff-attributed tickets, optionally narrowed to
  // one agent.
  const agentTickets = allTickets.filter(
    (t) => t.bookedByUserId && (!agentId || t.bookedByUserId === agentId)
  );
  const agentMap = new Map<
    string,
    { agentId: string; email: string; tickets: number; revenue: number; commission: number }
  >();
  for (const t of agentTickets) {
    const key = t.bookedByUserId!;
    const row = agentMap.get(key) ?? {
      agentId: key,
      email: t.bookedBy?.email ?? key,
      tickets: 0,
      revenue: 0,
      commission: 0,
    };
    row.tickets += 1;
    row.revenue += t.finalPrice;
    row.commission += t.commissionAmount ?? 0;
    agentMap.set(key, row);
  }
  const agentRows = Array.from(agentMap.values()).sort((a, b) => b.revenue - a.revenue);

  // Route/direction breakdown: every ticket with a real trip, regardless of
  // channel — this answers "which directions sell", not "which agent sold".
  const routeMap = new Map<string, { from: string; to: string; tickets: number; revenue: number }>();
  for (const t of allTickets) {
    if (!t.trip) continue;
    const key = `${t.trip.fromCity} → ${t.trip.toCity}`;
    const row = routeMap.get(key) ?? {
      from: t.trip.fromCity,
      to: t.trip.toCity,
      tickets: 0,
      revenue: 0,
    };
    row.tickets += 1;
    row.revenue += t.finalPrice;
    routeMap.set(key, row);
  }
  const routeRows = Array.from(routeMap.values()).sort((a, b) => b.revenue - a.revenue);

  // Payment method split across every ticket in range — "хто оплатив
  // агенту, а хто перевізнику".
  const paymentCounts = { ONLINE: 0, CASH_TO_AGENT: 0, CASH_TO_CARRIER: 0, UNSET: 0 };
  for (const t of allTickets) {
    if (t.paymentMethod) paymentCounts[t.paymentMethod] += 1;
    else paymentCounts.UNSET += 1;
  }

  const totalSystemRevenue = allTickets.reduce((sum, t) => sum + t.finalPrice, 0);
  const totalCommissionPaid = agentRows.reduce((sum, r) => sum + r.commission, 0);
  const netProfit = totalSystemRevenue - totalCommissionPaid;

  const agentCsvRows: (string | number)[][] = [
    ["Агент", "Квитків", "Виручка", "Комісія"],
    ...agentRows.map((r) => [r.email, r.tickets, r.revenue.toFixed(2), r.commission.toFixed(2)]),
    ["Разом", agentRows.reduce((s, r) => s + r.tickets, 0), totalSystemRevenue.toFixed(2), totalCommissionPaid.toFixed(2)],
  ];
  const routeCsvRows: (string | number)[][] = [
    ["Напрямок", "Квитків", "Виручка"],
    ...routeRows.map((r) => [`${r.from} → ${r.to}`, r.tickets, r.revenue.toFixed(2)]),
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
                ADMIN
              </span>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                Звіти
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Продажі по агентах і напрямках за період.
              </p>
            </div>
            <Link
              href="/admin"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              Назад в адмінку
            </Link>
          </div>

          <form
            method="GET"
            className="mt-6 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4"
          >
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-slate-600">Період від</span>
              <input
                type="date"
                name="dateFrom"
                defaultValue={toDateInputValue(dateFrom)}
                className="h-9 w-full rounded border border-slate-300 px-2"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-slate-600">Період до</span>
              <input
                type="date"
                name="dateTo"
                defaultValue={toDateInputValue(dateTo)}
                className="h-9 w-full rounded border border-slate-300 px-2"
              />
            </label>
            <label className="block text-xs sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-600">Агент</span>
              <select
                name="agentId"
                defaultValue={agentId}
                className="h-9 w-full rounded border border-slate-300 bg-white px-2"
              >
                <option value="">Усі агенти</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.email} ({a.role})
                  </option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-4">
              <button
                type="submit"
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Застосувати
              </button>
            </div>
          </form>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Виручка системи" value={money(totalSystemRevenue)} />
            <MetricCard label="Квитків усього" value={String(allTickets.length)} />
            <MetricCard label="Комісія агентам" value={money(totalCommissionPaid)} />
            <MetricCard label="Чистий прибуток" value={money(netProfit)} />
          </div>

          <section className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Хто скільки бронює (агенти)</h2>
              <ExportCsvButton
                filename={`agent-report-${toDateInputValue(dateFrom)}-${toDateInputValue(dateTo)}.csv`}
                rows={agentCsvRows}
              />
            </div>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="border-b border-slate-200 px-4 py-2">Агент</th>
                    <th className="border-b border-slate-200 px-4 py-2">Квитків</th>
                    <th className="border-b border-slate-200 px-4 py-2">Виручка</th>
                    <th className="border-b border-slate-200 px-4 py-2">Комісія</th>
                  </tr>
                </thead>
                <tbody>
                  {agentRows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={4}>
                        Немає бронювань агентів за цей період.
                      </td>
                    </tr>
                  ) : (
                    agentRows.map((r) => (
                      <tr key={r.agentId} className="odd:bg-white even:bg-slate-50">
                        <td className="border-t border-slate-100 px-4 py-2">{r.email}</td>
                        <td className="border-t border-slate-100 px-4 py-2 tabular-nums">
                          {r.tickets}
                        </td>
                        <td className="border-t border-slate-100 px-4 py-2 tabular-nums">
                          {money(r.revenue)}
                        </td>
                        <td className="border-t border-slate-100 px-4 py-2 tabular-nums">
                          {money(r.commission)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Статистика по напрямках</h2>
              <ExportCsvButton
                filename={`route-report-${toDateInputValue(dateFrom)}-${toDateInputValue(dateTo)}.csv`}
                rows={routeCsvRows}
              />
            </div>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="border-b border-slate-200 px-4 py-2">Напрямок</th>
                    <th className="border-b border-slate-200 px-4 py-2">Квитків</th>
                    <th className="border-b border-slate-200 px-4 py-2">Виручка</th>
                  </tr>
                </thead>
                <tbody>
                  {routeRows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={3}>
                        Немає бронювань за цей період.
                      </td>
                    </tr>
                  ) : (
                    routeRows.map((r) => (
                      <tr key={`${r.from}-${r.to}`} className="odd:bg-white even:bg-slate-50">
                        <td className="border-t border-slate-100 px-4 py-2">
                          {r.from} → {r.to}
                        </td>
                        <td className="border-t border-slate-100 px-4 py-2 tabular-nums">
                          {r.tickets}
                        </td>
                        <td className="border-t border-slate-100 px-4 py-2 tabular-nums">
                          {money(r.revenue)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-slate-900">
              Хто кому платив
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Розподіл усіх квитків за період за способом оплати (позначається
              персоналом на{" "}
              <Link href="/staff/tickets" className="underline">
                сторінці квитків
              </Link>
              ).
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard label={PAYMENT_LABELS.ONLINE} value={String(paymentCounts.ONLINE)} />
              <MetricCard
                label={PAYMENT_LABELS.CASH_TO_AGENT}
                value={String(paymentCounts.CASH_TO_AGENT)}
              />
              <MetricCard
                label={PAYMENT_LABELS.CASH_TO_CARRIER}
                value={String(paymentCounts.CASH_TO_CARRIER)}
              />
              <MetricCard label="Не позначено" value={String(paymentCounts.UNSET)} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
