import Header from "@/components/Header";
import {
  getPeriodReport,
  isValidPeriod,
  previousPeriod,
} from "@/lib/settlements";
import {
  GenerateSettlementsButton,
  MarkSentButton,
} from "@/components/admin/SettlementActions";

export const dynamic = "force-dynamic";

const eur = (n: number) => `€${n.toFixed(2)}`;

const STATUS_STYLES: Record<string, string> = {
  GENERATED: "bg-amber-50 text-amber-700 ring-amber-200",
  SENT: "bg-sky-50 text-sky-700 ring-sky-200",
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export default async function SettlementsPage(
  props: { searchParams: Promise<{ period?: string }> }
) {
  const searchParams = await props.searchParams;
  const requested = searchParams.period ?? previousPeriod();
  const period = isValidPeriod(requested) ? requested : previousPeriod();
  const report = await getPeriodReport(period);

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
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
            ADMIN
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            Carrier settlements
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sales per carrier for the period, the agency commission and the
            payout due to each carrier. Settlements (invoice + act) are
            generated automatically on the 7th of each month for the previous
            month — or manually below.
          </p>

          <form className="mt-6 flex flex-wrap items-end gap-3" method="get">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Period
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
              Show
            </button>
            <GenerateSettlementsButton period={period} />
          </form>

          <div className="mt-6 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Carrier</Th>
                  <Th className="text-right">Tickets</Th>
                  <Th className="text-right">Gross sales</Th>
                  <Th className="text-right">Our commission</Th>
                  <Th className="text-right">Carrier payout</Th>
                  <Th>Status</Th>
                  <Th>Documents</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      No sales recorded for {period}.
                    </td>
                  </tr>
                ) : (
                  report.map((row) => (
                    <tr key={row.carrierId}>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {row.carrierName}
                      </td>
                      <TdNum>{row.ticketCount}</TdNum>
                      <TdNum>{eur(row.grossAmount)}</TdNum>
                      <TdNum>
                        <span className="font-medium text-emerald-700">
                          {eur(row.commissionAmount)}
                        </span>
                      </TdNum>
                      <TdNum>
                        <span className="font-medium text-slate-900">
                          {eur(row.carrierAmount)}
                        </span>
                      </TdNum>
                      <td className="px-4 py-3">
                        {row.settled ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                              STATUS_STYLES[row.settlementStatus ?? "GENERATED"]
                            }`}
                          >
                            {row.settlementStatus}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
                            NOT INVOICED
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.settled && row.settlementId ? (
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <a
                              href={`/api/admin/settlements/${row.settlementId}/invoice`}
                              target="_blank"
                              className="font-medium text-brand-700 hover:underline"
                            >
                              {row.invoiceNumber}
                            </a>
                            <a
                              href={`/api/admin/settlements/${row.settlementId}/act`}
                              target="_blank"
                              className="font-medium text-brand-700 hover:underline"
                            >
                              Act
                            </a>
                            {row.settlementStatus === "GENERATED" ? (
                              <MarkSentButton settlementId={row.settlementId} />
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
                    <td className="px-4 py-3">Total</td>
                    <TdNum>{totals.ticketCount}</TdNum>
                    <TdNum>{eur(totals.grossAmount)}</TdNum>
                    <TdNum>
                      <span className="text-emerald-700">
                        {eur(totals.commissionAmount)}
                      </span>
                    </TdNum>
                    <TdNum>{eur(totals.carrierAmount)}</TdNum>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>

          <p className="mt-4 text-xs text-slate-400">
            Commission is snapshotted on every ticket at booking time
            (route-specific rule → carrier default), so historical reports do
            not change when rules are edited. Cancelled and refunded tickets
            are excluded.
          </p>
        </div>
      </main>
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
