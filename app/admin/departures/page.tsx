import Header from "@/components/Header";
import AdminShell from "@/components/admin/AdminShell";
import DeparturesBoard from "@/components/admin/DeparturesBoard";
import { prisma } from "@/lib/db";
import { addUtcDays, toIsoDate, todayUtc, utcDateOnly } from "@/lib/routes/dates";
import { toDepartureDTO } from "@/lib/routes/serialize";

export const dynamic = "force-dynamic";

export default async function AdminDeparturesPage({
  searchParams,
}: {
  searchParams?: { templateId?: string; from?: string; to?: string };
}) {
  const from = searchParams?.from || toIsoDate(todayUtc());
  const to = searchParams?.to || toIsoDate(addUtcDays(todayUtc(), 60));
  const templateId = searchParams?.templateId;

  const rows = await prisma.departure.findMany({
    where: {
      date: { gte: utcDateOnly(from), lte: utcDateOnly(to) },
      ...(templateId ? { templateId } : {}),
    },
    include: {
      template: { include: { country: true } },
      stops: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: [{ date: "asc" }, { template: { name: "asc" } }],
  });

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
            initialTemplateId={templateId}
            initialDepartures={rows.map(toDepartureDTO)}
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
