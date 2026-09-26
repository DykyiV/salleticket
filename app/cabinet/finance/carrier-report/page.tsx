import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import PageHeader from "@/components/cabinet/PageHeader";
import FinanceTabs from "@/components/finance/FinanceTabs";
import AgentBreakdownToggle from "@/components/finance/AgentBreakdownToggle";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { ROLE_LABEL } from "@/lib/auth/constants";
import { getCarrierReport } from "@/lib/finance/carrierReport";
import { TICKET_STATUS_CLASS, TICKET_STATUS_LABEL } from "@/lib/tickets/labels";

export const dynamic = "force-dynamic";

const eur = (n: number) => `€${n.toFixed(2)}`;

/**
 * Report 9.2 — carrier report: every passenger booked on this carrier across
 * the whole site for a sales month, with totals (gross, agency commission,
 * carrier share). The «розбити по агентах» checkbox adds a per-agent
 * breakdown: who booked what amount and the commission on their sales.
 * Both views can be exported as CSV.
 */
export default async function CarrierReportPage(
  props: {
    searchParams: Promise<{ carrier?: string; period?: string; group?: string }>;
  }
) {
  const user = await getCurrentUser();
  if (!user || !(await can(user, "finance.read"))) notFound();

  const searchParams = await props.searchParams;
  const groupByAgent = searchParams.group === "agents";
  const { carriers, carrier, period, tickets, totals, agentRows } =
    await getCarrierReport({ carrier: searchParams.carrier, period: searchParams.period });

  return (
    <div className="mx-auto max-w-7xl">
          <PageHeader
            title="Фінанси"
            subtitle="Звіт для перевізника: усі пасажири перевізника з усього сайту за місяць продажів."
          />
          <FinanceTabs current="/cabinet/finance/carrier-report" />

          <form
            method="GET"
            action="/cabinet/finance/carrier-report"
            className="mt-5 flex flex-wrap items-center gap-2"
          >
            <select
              name="carrier"
              defaultValue={carrier?.id}
              className="rounded-xl border-0 bg-white px-3.5 py-2 text-sm text-slate-700 ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-500"
            >
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.isOwnFleet ? " (власний автопарк)" : ""}
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
            {carrier ? (
              <span className="ml-auto flex flex-wrap gap-2">
                <a
                  href={`/api/finance/carrier-report/csv?carrier=${carrier.id}&period=${period}`}
                  className="rounded-xl bg-white px-3.5 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 transition hover:text-brand-700 hover:ring-brand-300"
                >
                  CSV: пасажири
                </a>
                {groupByAgent ? (
                  <a
                    href={`/api/finance/carrier-report/csv?carrier=${carrier.id}&period=${period}&kind=agents`}
                    className="rounded-xl bg-white px-3.5 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 transition hover:text-brand-700 hover:ring-brand-300"
                  >
                    CSV: агенти
                  </a>
                ) : null}
              </span>
            ) : null}
          </form>

          {carrier?.isOwnFleet ? (
            <p className="mt-4 rounded-xl bg-slate-100 px-4 py-2 text-xs text-slate-600">
              Власний автопарк: комісійного розподілу немає, тому комісія і частка
              перевізника порожні. Звіт показує продажі та хто їх оформив.
            </p>
          ) : null}

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
                        <td className="px-4 py-3 text-slate-500">{ROLE_LABEL[a.role] ?? a.role}</td>
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
                        {t.reference ? (
                          <Link
                            href={`/cabinet/tickets/${t.reference}`}
                            className="font-medium font-mono text-brand-700 hover:underline"
                          >
                            {t.reference}
                          </Link>
                        ) : (
                          <span className="text-slate-400">{t.id.slice(-8)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{t.passenger ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{t.route ?? "—"}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">
                        {t.departureTime
                          ? t.departureTime.toISOString().slice(0, 16).replace("T", " ")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{t.bookedBy}</td>
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
                            TICKET_STATUS_CLASS[t.status]
                          }`}
                        >
                          {TICKET_STATUS_LABEL[t.status] ?? t.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
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
