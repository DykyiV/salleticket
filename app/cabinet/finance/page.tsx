import { notFound } from "next/navigation";
import PageHeader from "@/components/cabinet/PageHeader";
import FinanceTabs from "@/components/finance/FinanceTabs";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import {
  getPeriodReport,
  getSettlementHistory,
  isValidPeriod,
  previousPeriod,
} from "@/lib/settlements";
import {
  GenerateSettlementsButton,
  MarkPaidButton,
  MarkSentButton,
} from "@/components/finance/SettlementActions";

export const dynamic = "force-dynamic";

const eur = (n: number) => `€${n.toFixed(2)}`;

const STATUS_STYLES: Record<string, string> = {
  GENERATED: "bg-amber-50 text-amber-700 ring-amber-200",
  SENT: "bg-sky-50 text-sky-700 ring-sky-200",
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const BALANCE_LABELS: Record<string, string> = {
  TO_CARRIER: "Ми винні перевізнику",
  TO_AGENT: "Перевізник винен нам",
  ZERO: "Розраховано",
};

const STATUS_LABELS: Record<string, string> = {
  GENERATED: "Сформовано",
  SENT: "Надіслано",
  PAID: "Оплачено",
};

export default async function SettlementsPage(
  props: { searchParams: Promise<{ period?: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !(await can(user, "finance.read"))) notFound();
  const canEdit = await can(user, "finance.edit");

  const searchParams = await props.searchParams;
  const requested = searchParams.period ?? previousPeriod();
  const period = isValidPeriod(requested) ? requested : previousPeriod();
  const [report, history] = await Promise.all([
    getPeriodReport(period),
    getSettlementHistory(30),
  ]);

  const totals = report.reduce(
    (acc, row) => ({
      ticketCount: acc.ticketCount + row.ticketCount,
      grossAmount: acc.grossAmount + row.grossAmount,
      commissionAmount: acc.commissionAmount + row.commissionAmount,
      carrierAmount: acc.carrierAmount + row.carrierAmount,
    }),
    { ticketCount: 0, grossAmount: 0, commissionAmount: 0, carrierAmount: 0 }
  );

  return (
    <div className="mx-auto max-w-7xl">
          <PageHeader
            title="Фінанси"
            subtitle="Продажі по перевізниках з розподілом за місцем оплати: гроші, що зібрали ми (онлайн), і ті, що зібрав перевізник (готівка) — баланс показує, хто кому винен. Розрахунки формуються автоматично 7-го числа кожного місяця або вручну нижче. Власний автопарк у розрахунки не входить."
          />
          <FinanceTabs current="/cabinet/finance" />

          <form className="mt-6 flex flex-wrap items-end gap-3" method="get">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Період
              </span>
              <input
                type="month"
                name="period"
                defaultValue={period}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              Показати
            </button>
            {canEdit ? <GenerateSettlementsButton period={period} /> : null}
          </form>

          <div className="mt-6 overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Перевізник</Th>
                  <Th className="text-right">Квитків</Th>
                  <Th className="text-right">Виручка</Th>
                  <Th className="text-right">Отримали ми (онлайн)</Th>
                  <Th className="text-right">Отримав перевізник (готівка)</Th>
                  <Th className="text-right">Не оплачено</Th>
                  <Th className="text-right">Наша комісія</Th>
                  <Th className="text-right">Баланс</Th>
                  <Th>Статус</Th>
                  <Th>Документи</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      За {period} продажів немає.
                    </td>
                  </tr>
                ) : (
                  report.map((row) => (
                    <tr key={row.carrierId}>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                        {row.carrierName}
                      </td>
                      <TdNum>{row.ticketCount}</TdNum>
                      <TdNum>{eur(row.grossAmount)}</TdNum>
                      <TdNum>{eur(row.collectedByAgent)}</TdNum>
                      <TdNum>{eur(row.collectedByCarrier)}</TdNum>
                      <TdNum>
                        <span className="text-slate-400">
                          {eur(row.unpaidAmount)}
                        </span>
                      </TdNum>
                      <TdNum>
                        <span className="font-medium text-emerald-700">
                          {eur(row.commissionAmount)}
                        </span>
                      </TdNum>
                      <TdNum>
                        <div className="font-semibold text-slate-900">
                          {eur(row.balanceAmount)}
                        </div>
                        <div className="text-[11px] font-normal text-slate-500">
                          {BALANCE_LABELS[row.balanceDirection]}
                        </div>
                      </TdNum>
                      <td className="px-4 py-3">
                        {row.settled ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                              STATUS_STYLES[row.settlementStatus ?? "GENERATED"]
                            }`}
                          >
                            {STATUS_LABELS[row.settlementStatus ?? "GENERATED"]}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
                            НЕ ВИСТАВЛЕНО
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.settled && row.settlementId ? (
                          <div className="flex flex-col items-start gap-1.5 whitespace-nowrap text-xs">
                            <div className="flex items-center gap-3">
                              <a
                                href={`/api/finance/settlements/${row.settlementId}/invoice`}
                                target="_blank"
                                className="font-medium text-brand-700 hover:underline"
                              >
                                {row.invoiceNumber}
                              </a>
                              <a
                                href={`/api/finance/settlements/${row.settlementId}/act`}
                                target="_blank"
                                className="font-medium text-brand-700 hover:underline"
                              >
                                Акт
                              </a>
                            </div>
                            {canEdit ? (
                              <div className="flex items-center gap-2">
                                {row.settlementStatus === "GENERATED" ? (
                                  <MarkSentButton settlementId={row.settlementId} />
                                ) : null}
                                {row.settlementStatus === "SENT" ||
                                row.settlementStatus === "GENERATED" ? (
                                  <MarkPaidButton settlementId={row.settlementId} />
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {report.length > 0 ? (
                <tfoot className="bg-slate-50">
                  <tr className="font-semibold text-slate-900">
                    <td className="px-4 py-3">Разом</td>
                    <TdNum>{totals.ticketCount}</TdNum>
                    <TdNum>{eur(totals.grossAmount)}</TdNum>
                    <TdNum>{eur(report.reduce((s, r) => s + r.collectedByAgent, 0))}</TdNum>
                    <TdNum>{eur(report.reduce((s, r) => s + r.collectedByCarrier, 0))}</TdNum>
                    <TdNum>{eur(report.reduce((s, r) => s + r.unpaidAmount, 0))}</TdNum>
                    <TdNum>
                      <span className="text-emerald-700">
                        {eur(totals.commissionAmount)}
                      </span>
                    </TdNum>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>

          <p className="mt-4 text-xs text-slate-400">
            Комісія фіксується на кожному квитку в момент бронювання. Баланс =
            частка перевізника з онлайн-продажів − наша комісія з готівкових.
            Скасовані та повернені квитки не враховуються.
          </p>

          <section className="mt-10">
            <h2 className="text-lg font-semibold text-slate-900">
              Історія розрахунків
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Кожна подія: сформовано, надіслано, оплачено — хто і коли.
            </p>
            <div className="mt-4 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Коли</Th>
                    <Th>Перевізник</Th>
                    <Th>Рахунок</Th>
                    <Th>Подія</Th>
                    <Th>Хто</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-sm text-slate-500"
                      >
                        Подій ще не було.
                      </td>
                    </tr>
                  ) : (
                    history.map((event) => (
                      <tr key={event.id}>
                        <td className="px-4 py-2.5 tabular-nums text-slate-500">
                          {event.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-900">
                          {event.settlement.carrier.name}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {event.settlement.invoiceNumber}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                              STATUS_STYLES[event.action] ??
                              "bg-slate-100 text-slate-600 ring-slate-200"
                            }`}
                          >
                            {STATUS_LABELS[event.action] ?? event.action}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {event.actor ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
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

function TdNum({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
      {children}
    </td>
  );
}
