import { notFound } from "next/navigation";
import PageHeader from "@/components/cabinet/PageHeader";
import FinanceTabs from "@/components/finance/FinanceTabs";
import PaymentDialog, { DeletePaymentButton } from "@/components/finance/PaymentDialog";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getReconciliation, listRecentPayments, type ReconciliationRow } from "@/lib/finance/reconciliation";
import { eur, SIDE_CLASS, SIDE_LABEL } from "@/lib/finance/labels";

export const dynamic = "force-dynamic";

/** Signed amount: plus — in the counterparty's favour, minus — in ours. */
const signed = (n: number) => (n < -0.004 ? `−${eur(-n)}` : eur(n));

const DIRECTION_TEXT = {
  CARRIER: { OUTGOING: "Ми → перевізнику", INCOMING: "Перевізник → нам" },
  AGENT: { OUTGOING: "Ми → агенту", INCOMING: "Агент → нам" },
} as const;

/**
 * Звірка — for every carrier and sales agent: 1) accrued, 2) paid,
 * 3) open balance: who owes whom. Payments are recorded here.
 */
export default async function ReconciliationPage() {
  const user = await getCurrentUser();
  if (!user || !(await can(user, "finance.read"))) notFound();
  const canEdit = await can(user, "finance.edit");

  const [{ carriers, agents, totals }, payments] = await Promise.all([
    getReconciliation(),
    listRecentPayments(30),
  ]);
  const all = [...carriers, ...agents];
  const weOwe = all.filter((r) => r.side === "WE_OWE").reduce((s, r) => s + r.debt, 0);
  const theyOwe = all.filter((r) => r.side === "THEY_OWE").reduce((s, r) => s - r.debt, 0);
  const withDebt = all.filter((r) => r.side !== "SETTLED").length;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Фінанси"
        subtitle="Звірка з перевізниками та агентами: скільки нараховано за документами, скільки фактично виплачено і чи лишився борг. Плюс — на користь контрагента (ми винні), мінус — на нашу користь."
      />
      <FinanceTabs current="/cabinet/finance/reconciliation" />

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Ми винні" value={eur(weOwe)} tone="text-amber-700" />
        <Tile label="Нам винні" value={eur(theyOwe)} tone="text-sky-700" />
        <Tile
          label="Контрагентів з боргом"
          value={String(withDebt)}
          tone={withDebt ? "text-slate-900" : "text-emerald-700"}
          hint={withDebt ? undefined : "усі розраховані"}
        />
      </div>

      <div className="mt-4 flex justify-end">
        <a
          href="/api/finance/reconciliation/csv"
          className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:border-brand-300 hover:text-brand-700"
        >
          CSV: звірка
        </a>
      </div>

      <Section
        title="Перевізники"
        note="Нараховано — сальдо сформованих розрахунків (рахунок + акт) за всі місяці. «Позначити оплаченим» у розрахунках вносить платіж автоматично."
        docsLabel="Розрахунків"
        rows={carriers}
        total={totals.carriers}
        canEdit={canEdit}
        detailLabel="Останній місяць"
      />
      <Section
        title="Агенти"
        note="Нараховано — винагорода агента: % від оплачених квитків, які він оформив (% фіксується на квитку в момент продажу). Відсоток задається у вкладці «Автозвіти»."
        docsLabel="Оплачених квитків"
        rows={agents}
        total={totals.agents}
        canEdit={canEdit}
        detailLabel="Винагорода"
      />

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">Останні платежі</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Th>Дата</Th>
                <Th>Контрагент</Th>
                <Th>Напрям</Th>
                <Th className="text-right">Сума</Th>
                <Th>Коментар</Th>
                <Th>Вніс</Th>
                {canEdit ? <Th /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="px-4 py-8 text-center text-slate-500">
                    Платежів ще не вносили.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-600">
                      {p.paidAt.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {p.carrier?.name ?? p.user?.displayName ?? p.user?.email ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                      {DIRECTION_TEXT[p.kind][p.direction]}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums font-medium text-slate-900">
                      {eur(p.amount)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {p.note ?? (p.settlement ? p.settlement.invoiceNumber : "—")}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{p.createdBy ?? "—"}</td>
                    {canEdit ? (
                      <td className="px-4 py-2.5 text-right">
                        <DeletePaymentButton paymentId={p.id} />
                      </td>
                    ) : null}
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

function Section({
  title,
  note,
  docsLabel,
  detailLabel,
  rows,
  total,
  canEdit,
}: {
  title: string;
  note: string;
  docsLabel: string;
  detailLabel: string;
  rows: ReconciliationRow[];
  total: { accrued: number; paid: number; debt: number; side: ReconciliationRow["side"] };
  canEdit: boolean;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{note}</p>
      <div className="mt-3 overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <Th>{title === "Агенти" ? "Агент" : "Перевізник"}</Th>
              <Th className="text-right">{docsLabel}</Th>
              <Th>{detailLabel}</Th>
              <Th className="text-right">1. Нараховано</Th>
              <Th className="text-right">2. Виплачено</Th>
              <Th className="text-right">3. Борг</Th>
              <Th>Підсумок</Th>
              {canEdit ? <Th /> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 8 : 7} className="px-4 py-8 text-center text-slate-500">
                  Немає контрагентів.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                    {r.documents}
                    {r.salesGross ? (
                      <div className="text-[11px] text-slate-400">{eur(r.salesGross)}</div>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{r.detail ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">{signed(r.accrued)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">{signed(r.paid)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                    {eur(Math.abs(r.debt))}
                  </td>
                  <td className="px-4 py-3">
                    <Badge side={r.side} />
                  </td>
                  {canEdit ? (
                    <td className="px-4 py-3 text-right">
                      <PaymentDialog kind={r.kind} counterpartyId={r.id} name={r.name} debt={r.debt} />
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 ? (
            <tfoot className="bg-slate-50 font-semibold text-slate-900">
              <tr>
                <td className="px-4 py-3" colSpan={3}>
                  Разом (сальдо)
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{signed(total.accrued)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{signed(total.paid)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{eur(Math.abs(total.debt))}</td>
                <td className="px-4 py-3" colSpan={canEdit ? 2 : 1}>
                  <Badge side={total.side} />
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  );
}

function Badge({ side }: { side: ReconciliationRow["side"] }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${SIDE_CLASS[side]}`}
    >
      {SIDE_LABEL[side]}
    </span>
  );
}

function Tile({ label, value, tone, hint }: { label: string; value: string; tone: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</div>
      {hint ? <div className="text-xs text-slate-400">{hint}</div> : null}
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${className}`}>
      {children}
    </th>
  );
}
