import { eur } from "@/lib/finance/labels";
import type { ReconciliationRow } from "@/lib/finance/reconciliation";

/** The agent's side of the settlement — the agent's own row only. */
const AGENT_SIDE: Record<ReconciliationRow["side"], { label: string; cls: string }> = {
  WE_OWE: { label: "Компанія винна вам", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  THEY_OWE: { label: "Ви винні компанії", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  SETTLED: { label: "Розраховано", cls: "bg-slate-50 text-slate-700 ring-slate-200" },
};

export default function AgentSettlementCard({ row }: { row: ReconciliationRow }) {
  const side = AGENT_SIDE[row.side];
  const items: [string, string][] = [
    ["Оплачених продажів", `${row.documents} · ${eur(row.salesGross ?? 0)}`],
    [`Винагорода${row.detail ? ` (${row.detail})` : ""}`, eur(row.reward ?? 0)],
    ["Готівка пасажирів у вас", eur(row.cashHeld ?? 0)],
    ["Уже розраховано платежами", eur(Math.abs(row.paid))],
  ];
  return (
    <section className="mt-4 rounded-2xl bg-white p-6 ring-1 ring-slate-200" aria-label="Мої розрахунки">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">Мої розрахунки</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${side.cls}`}>
          {side.label}
          {row.side === "SETTLED" ? "" : `: ${eur(Math.abs(row.debt))}`}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        {items.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-slate-50 px-3 py-2">
            <dt className="text-xs text-slate-500">{k}</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-slate-500">
        Винагорода зараховується з готівки, яку ви тримаєте. Питання щодо розрахунку — до бухгалтерії.
      </p>
    </section>
  );
}
