import Header from "@/components/Header";
import AdminShell from "@/components/admin/AdminShell";
import RouteTemplateEditor from "@/components/admin/RouteTemplateEditor";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewRouteTemplatePage() {
  const countries = await prisma.country.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { templates: true } } },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <AdminShell
          wide
          title="Новий шаблон маршруту"
          subtitle="Назва = початковий і кінцевий пункт. Далі — дні виїзду, контакти і конструктор міст."
        >
          <RouteTemplateEditor
            countries={countries.map((c) => ({
              id: c.id,
              name: c.name,
              code: c.code,
              templateCount: c._count.templates,
            }))}
          />
        </AdminShell>
      </main>
    </div>
  );
}
