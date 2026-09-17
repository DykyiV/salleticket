import PageHeader from "@/components/cabinet/PageHeader";
import DeparturesBoard from "@/components/admin/DeparturesBoard";
import { getCurrentUser } from "@/lib/auth/session";
import {
  listDepartureFilterOptions,
  listDepartures,
} from "@/lib/routes/listDepartures";
import { departureCapabilities, isAdminRole } from "@/lib/routes/permissions";

export const dynamic = "force-dynamic";

export default async function CabinetDeparturesPage({
  searchParams,
}: {
  searchParams?: {
    templateId?: string;
    countryId?: string;
    from?: string;
    to?: string;
    page?: string;
  };
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const admin = isAdminRole(user.role);
  const capabilities = departureCapabilities(user);
  const [list, filters] = await Promise.all([
    listDepartures({
      from: searchParams?.from,
      to: searchParams?.to,
      templateId: searchParams?.templateId,
      countryId: searchParams?.countryId,
      page: searchParams?.page,
    }),
    listDepartureFilterOptions(),
  ]);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Виїзди"
        subtitle={
          capabilities.canBulk
            ? "Фільтр за країною, маршрутом і датами. Масове редагування — для адміна або агента з правом."
            : "Фільтр за країною, маршрутом і датами. Усі напрямки на місяць уперед, по 15 на сторінку."
        }
      />
      <DeparturesBoard
        mode={admin ? "admin" : "agent"}
        initialFrom={list.from}
        initialTo={list.to}
        initialTemplateId={searchParams?.templateId}
        initialCountryId={searchParams?.countryId}
        initialPage={list.page}
        initialTotal={list.total}
        initialTotalPages={list.totalPages}
        initialDepartures={list.departures}
        countries={filters.countries}
        routes={filters.routes}
        capabilities={capabilities}
      />
    </div>
  );
}
