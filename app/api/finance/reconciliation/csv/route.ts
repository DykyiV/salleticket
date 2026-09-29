import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { getReconciliation, type ReconciliationRow } from "@/lib/finance/reconciliation";
import { csvDisposition, toCsv } from "@/lib/finance/csv";
import { SIDE_LABEL } from "@/lib/finance/labels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/finance/reconciliation/csv — the reconciliation table for Excel. */
export async function GET() {
  const guard = await requirePermission("finance.read");
  if (!guard.ok) return guard.response;
  const { carriers, agents } = await getReconciliation();
  const line = (type: string) => (r: ReconciliationRow) => [
    type,
    r.name,
    r.accrued,
    r.paid,
    Math.abs(r.debt),
    SIDE_LABEL[r.side],
  ];
  const csv = toCsv(
    ["Тип", "Контрагент", "Нараховано, EUR", "Виплачено, EUR", "Борг, EUR", "Хто кому винен"],
    [...carriers.map(line("Перевізник")), ...agents.map(line("Агент"))]
  );
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": csvDisposition(`zvirka-${date}.csv`),
      "Cache-Control": "no-store",
    },
  });
}
