import type { getSettlementLines } from "@/lib/settlements";

type SettlementData = NonNullable<Awaited<ReturnType<typeof getSettlementLines>>>;

const eur = (n: number) =>
  n.toLocaleString("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TRANSPORT_UA: Record<string, string> = {
  BUS: "Автобус",
  FLIGHT: "Авіа",
  TRAIN: "Потяг",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 40px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { color: #475569; font-size: 13px; margin-bottom: 24px; }
  .parties { display: flex; gap: 48px; margin-bottom: 24px; font-size: 14px; }
  .parties h2 { font-size: 12px; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
  th { background: #f1f5f9; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { margin-top: 16px; font-size: 15px; }
  .totals div { display: flex; justify-content: space-between; max-width: 420px; padding: 4px 0; }
  .totals .grand { font-weight: 700; border-top: 2px solid #0f172a; margin-top: 6px; padding-top: 8px; }
  .sign { margin-top: 56px; display: flex; justify-content: space-between; font-size: 14px; }
  .sign div { border-top: 1px solid #94a3b8; padding-top: 6px; width: 40%; text-align: center; color: #475569; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>${body}</body>
</html>`;
}

function parties(carrierName: string): string {
  return `
  <div class="parties">
    <div>
      <h2>Постачальник (агент)</h2>
      <div>ТОВ «Asol BUS Marketplace»</div>
      <div>ЄДРПОУ 00000000 · Україна, м. Київ</div>
    </div>
    <div>
      <h2>Отримувач (перевізник)</h2>
      <div>${escapeHtml(carrierName)}</div>
    </div>
  </div>`;
}

function linesTable(data: SettlementData): string {
  const rows = data.lines
    .map(
      (l) => `<tr>
        <td>${escapeHtml(TRANSPORT_UA[l.transportType] ?? l.transportType)}</td>
        <td>${escapeHtml(l.route)}</td>
        <td class="num">${l.count}</td>
        <td class="num">${eur(l.gross)}</td>
        <td class="num">${eur(l.commission)}</td>
        <td class="num">${eur(l.payout)}</td>
      </tr>`
    )
    .join("");

  return `<table>
    <thead>
      <tr>
        <th>Тип</th><th>Напрямок</th>
        <th class="num">Квитків</th>
        <th class="num">Продажі, €</th>
        <th class="num">Винагорода агента, €</th>
        <th class="num">До виплати перевізнику, €</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function totals(data: SettlementData): string {
  const s = data.settlement;
  const balanceLine =
    s.balanceDirection === "TO_AGENT"
      ? `<div class="grand"><span>Сальдо: перевізник сплачує агенту</span><span>€${eur(s.balanceAmount)}</span></div>`
      : s.balanceDirection === "ZERO"
        ? `<div class="grand"><span>Сальдо</span><span>€0,00 — взаєморозрахунок закрито</span></div>`
        : `<div class="grand"><span>Сальдо: агент сплачує перевізнику</span><span>€${eur(s.balanceAmount)}</span></div>`;
  return `
  <div class="totals">
    <div><span>Продано квитків</span><span>${s.ticketCount}</span></div>
    <div><span>Загальна сума продажів</span><span>€${eur(s.grossAmount)}</span></div>
    <div><span>· оплачено агенту (онлайн)</span><span>€${eur(s.collectedByAgent)}</span></div>
    <div><span>· оплачено перевізнику (готівка)</span><span>€${eur(s.collectedByCarrier)}</span></div>
    <div><span>· ще не оплачено</span><span>€${eur(s.unpaidAmount)}</span></div>
    <div><span>Винагорода агента (залишається у нас)</span><span>€${eur(s.commissionAmount)}</span></div>
    <div><span>Частка перевізника</span><span>€${eur(s.carrierAmount)}</span></div>
    ${balanceLine}
  </div>`;
}

/** Рахунок-фактура (invoice) for the carrier payout. */
export function renderInvoice(data: SettlementData): string {
  const s = data.settlement;
  const body = `
  <h1>Рахунок-фактура № ${escapeHtml(s.invoiceNumber)}</h1>
  <div class="meta">Період: ${escapeHtml(s.period)} · Дата формування: ${s.createdAt.toISOString().slice(0, 10)}</div>
  ${parties(s.carrier.name)}
  ${linesTable(data)}
  ${totals(data)}
  <div class="sign"><div>Постачальник</div><div>Отримувач</div></div>`;
  return layout(`Рахунок ${s.invoiceNumber}`, body);
}

/** Акт наданих послуг (act of services) — agency commission confirmation. */
export function renderAct(data: SettlementData): string {
  const s = data.settlement;
  const actNumber = s.actNumber ?? s.invoiceNumber.replace("INV", "ACT");
  const body = `
  <h1>Акт наданих послуг № ${escapeHtml(actNumber)}</h1>
  <div class="meta">Період: ${escapeHtml(s.period)} · Дата формування: ${s.createdAt.toISOString().slice(0, 10)}</div>
  ${parties(s.carrier.name)}
  <p style="font-size:14px">Цей акт підтверджує, що агент ТОВ «Asol BUS Marketplace» у звітному періоді
  надав послуги з продажу квитків на рейси перевізника, а саме:</p>
  ${linesTable(data)}
  ${totals(data)}
  <p style="font-size:13px;color:#475569;margin-top:16px">
    Винагорода агента утримується із сум продажів; різниця підлягає перерахуванню перевізнику
    згідно з рахунком-фактурою № ${escapeHtml(s.invoiceNumber)}.
  </p>
  <div class="sign"><div>Постачальник</div><div>Отримувач</div></div>`;
  return layout(`Акт ${actNumber}`, body);
}
