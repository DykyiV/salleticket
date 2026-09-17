import PageHeader from "@/components/cabinet/PageHeader";
import DeparturesBoard from "@/components/admin/DeparturesBoard";
import { getCurrentUser } from "@/lib/auth/session";
import { listDepartures } from "@/lib/routes/listDepartures";
import { departureCapabilities, isAdminRole } from "@/lib/routes/permissions";

export const dynamic = "force-dynamic";

export default async function CabinetDeparturesPage({
  searchParams,
}: {
  searchParams?: {
    templateId?: string;
    from?: string;
    to?: string;
    page?: string;
  };
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const admin = isAdminRole(user.role);
  const capabilities = departureCapabilities(user);
  const list = await listDepartures({
    from: searchParams?.from,
    to: searchParams?.to,
    templateId: searchParams?.templateId,
    page: searchParams?.page,
  });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Виїзди"
        subtitle={
          capabilities.canBulk
            ? "Усі напрямки на місяць уперед, по 15 на сторінку. Масове редагування — для адміна або агента з відповідним правом."
            : "Усі напрямки на місяць уперед, по 15 виїздів на сторінку."
        }
      />
      <DeparturesBoard
        mode={admin ? "admin" : "agent"}
        initialFrom={list.from}
        initialTo={list.to}
        initialTemplateId={searchParams?.templateId}
        initialPage={list.page}
        initialTotal={list.total}
        initialTotalPages={list.totalPages}
        initialDepartures={list.departures}
        capabilities={capabilities}
      />
    </div>
  );
}
