import PageHeader from "@/components/cabinet/PageHeader";
import GtDeparturesBoard from "@/components/admin/GtDeparturesBoard";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/routes/permissions";
import { gtListTrips, todayIso, offsetDate } from "@/lib/carriers/grandes-tour/admin";

export const dynamic = "force-dynamic";

export default async function GtDeparturesPage() {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) return null;

  const from = todayIso();
  const to = offsetDate(14);
  const trips = await gtListTrips(from, to);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Виїзди GT"
        subtitle="Всі рейси Grandes Tour за вибраний період. Натисніть «Деталі», щоб переглянути місця."
      />
      <GtDeparturesBoard initialTrips={trips} initialFrom={from} initialTo={to} />
    </div>
  );
}
