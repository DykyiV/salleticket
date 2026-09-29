import { notFound } from "next/navigation";
import PageHeader from "@/components/cabinet/PageHeader";
import FinanceTabs from "@/components/finance/FinanceTabs";
import CommissionManager from "@/components/finance/CommissionManager";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Agency commission per third-party carrier (default %) and per route
 * (override). Own-fleet carriers are not listed — they have no split.
 * Viewing needs finance.read; changing rules needs finance.edit (the API
 * enforces it; the page shows a read-only notice otherwise).
 */
export default async function CommissionsPage() {
  const user = await getCurrentUser();
  if (!user || !(await can(user, "finance.read"))) notFound();
  const canEdit = await can(user, "finance.edit");

  const carriers = await prisma.carrier.findMany({
    where: { isOwnFleet: false },
    include: {
      commissionRules: { orderBy: [{ fromCity: "asc" }, { toCity: "asc" }] },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Фінанси"
        subtitle="Комісія агентства для кожного перевізника (базова) і для окремих маршрутів (перевизначення). Зміни діють лише на нові бронювання — комісія на проданих квитках і в сформованих розрахунках не змінюється."
      />
      <FinanceTabs current="/cabinet/finance/commissions" />
      {canEdit ? (
        <CommissionManager carriers={carriers} />
      ) : (
        <ul className="space-y-2 text-sm">
          {carriers.map((c) => (
            <li key={c.id} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <span className="font-semibold text-slate-900">{c.name}</span> —{" "}
              {c.commissionPercent}% базова
              {c.commissionRules.length > 0
                ? `; маршрути: ${c.commissionRules
                    .map((r) => `${r.fromCity} → ${r.toCity} ${r.percent}%`)
                    .join(", ")}`
                : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
