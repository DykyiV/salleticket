import PageHeader from "@/components/cabinet/PageHeader";
import RouteTemplateEditor from "@/components/admin/RouteTemplateEditor";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewCabinetRoutePage() {
  const countries = await prisma.country.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { templates: true } } },
  });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Новий шаблон маршруту"
        subtitle="Назва = початковий і кінцевий пункт. Далі — дні виїзду, контакти і конструктор міст."
      />
      <RouteTemplateEditor
        countries={countries.map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          templateCount: c._count.templates,
        }))}
      />
    </div>
  );
}
