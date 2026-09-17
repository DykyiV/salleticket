import Header from "@/components/Header";
import AdminShell from "@/components/admin/AdminShell";
import DeparturesBoard from "@/components/admin/DeparturesBoard";
import { addUtcDays, toIsoDate, todayUtc } from "@/lib/routes/dates";

export const dynamic = "force-dynamic";

export default function AdminDeparturesPage({
  searchParams,
}: {
  searchParams?: { templateId?: string; from?: string; to?: string };
}) {
  const from = searchParams?.from || toIsoDate(todayUtc());
  const to = searchParams?.to || toIsoDate(addUtcDays(todayUtc(), 60));

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <AdminShell
          wide
          title="Виїзди"
          subtitle="Чекбокси біля маршрутів — щоб сховати міста, змінити години або продаж місць одразу на кількох однакових виїздах."
        >
          <DeparturesBoard
            mode="admin"
            initialFrom={from}
            initialTo={to}
            initialTemplateId={searchParams?.templateId}
            capabilities={{
              canEdit: true,
              canHideStops: true,
              canHideSeats: true,
              canManageTemplates: true,
            }}
          />
        </AdminShell>
      </main>
    </div>
  );
}
