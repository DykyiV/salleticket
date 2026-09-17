import { notFound } from "next/navigation";
import Header from "@/components/Header";
import AdminShell from "@/components/admin/AdminShell";
import RouteTemplateEditor from "@/components/admin/RouteTemplateEditor";
import { prisma } from "@/lib/db";
import { toTemplateDTO } from "@/lib/routes/serialize";

export const dynamic = "force-dynamic";

export default async function EditRouteTemplatePage({
  params,
}: {
  params: { id: string };
}) {
  const [template, countries] = await Promise.all([
    prisma.routeTemplate.findUnique({
      where: { id: params.id },
      include: {
        country: true,
        stops: { orderBy: { sortOrder: "asc" } },
        _count: { select: { departures: true } },
      },
    }),
    prisma.country.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { templates: true } } },
    }),
  ]);

  if (!template) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <AdminShell
          wide
          title={template.name}
          subtitle="Редагуйте шаблон. Галочка внизу перенесе зміни на вже створені виїзди за період."
        >
          <RouteTemplateEditor
            template={toTemplateDTO(template)}
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
