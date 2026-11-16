import PageHeader from "@/components/cabinet/PageHeader";
import CarriersPanel from "@/components/admin/CarriersPanel";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/routes/permissions";
import { gtCarrierBuses, offsetDate, todayIso } from "@/lib/carriers/grandes-tour/admin";

export const dynamic = "force-dynamic";

export default async function CarriersPage() {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) return null;

  const carriers = await gtCarrierBuses(todayIso(), offsetDate(30));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Перевізники"
        subtitle="Автобуси та перевізники за рейсами GT на найближчі 30 днів (минулі рейси GT не віддає)."
      />
      <CarriersPanel carriers={carriers} asOf={todayIso()} />
    </div>
  );
}
