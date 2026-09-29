import { notFound } from "next/navigation";
import PageHeader from "@/components/cabinet/PageHeader";
import FinanceTabs from "@/components/finance/FinanceTabs";
import AutoReportsForm from "@/components/finance/AutoReportsForm";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getAutoReportsEnabled, listAutoReportRows } from "@/lib/finance/autoReports";

export const dynamic = "force-dynamic";

/**
 * Автозвіти — per carrier / agent: send or not, day of month, e-mail
 * (+ agent reward %). A global switch keeps everything off until enabled.
 */
export default async function AutoReportsPage() {
  const user = await getCurrentUser();
  if (!user || !(await can(user, "finance.read"))) notFound();
  const canEdit = await can(user, "finance.edit");
  const [enabled, rows] = await Promise.all([getAutoReportsEnabled(), listAutoReportRows()]);
  const serialize = (list: typeof rows.carriers) =>
    list.map((r) => ({ ...r, lastSentAt: r.lastSentAt ? r.lastSentAt.toISOString() : null }));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Фінанси"
        subtitle="Щомісячні автозвіти контрагентам: перевізникам — розрахунок (рахунок і акт) за попередній місяць, агентам — продажі й винагорода та сальдо. Позначте, кому надсилати і якого числа."
      />
      <FinanceTabs current="/cabinet/finance/auto-reports" />
      <AutoReportsForm
        canEdit={canEdit}
        initialEnabled={enabled}
        carriers={serialize(rows.carriers)}
        agents={serialize(rows.agents)}
      />
    </div>
  );
}
