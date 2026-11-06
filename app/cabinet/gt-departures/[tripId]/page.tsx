import PageHeader from "@/components/cabinet/PageHeader";
import GtTripDetail from "@/components/admin/GtTripDetail";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/routes/permissions";
import { gtTripPassengers } from "@/lib/carriers/grandes-tour/admin";

export const dynamic = "force-dynamic";

export default async function GtTripPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ from?: string; to?: string; title?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) return null;

  const { tripId } = await params;
  const sp = await searchParams;
  const id = Number(tripId);
  if (!Number.isFinite(id)) return null;

  const occupancy = await gtTripPassengers(id, Number(sp.from) || undefined, Number(sp.to) || undefined);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={`Рейс #${id}`}
        subtitle={sp.title ? `${sp.title} · дані Grandes Tour` : "Схема салону та заповненість за даними Grandes Tour API"}
      />
      <GtTripDetail
        tripId={id}
        places={occupancy.places}
        total={occupancy.total}
        sold={occupancy.sold}
        free={occupancy.free}
      />
    </div>
  );
}
