import { notFound } from "next/navigation";
import PageHeader from "@/components/cabinet/PageHeader";
import RouteTemplateEditor from "@/components/admin/RouteTemplateEditor";
import { prisma } from "@/lib/db";
import { toTemplateDTO } from "@/lib/routes/serialize";

export const dynamic = "force-dynamic";

export default async function EditCabinetRoutePage({
  params,
}: {
  params: { id: string };
}) {
  const [template, countries] = await Promise.all([
    prisma.routeTemplate.findUnique({
      where: { id: params.id },
      include: {
        country: true,
        originCountry: true,
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
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={template.name}
        subtitle="Галочка внизу перенесе зміни на вже створені виїзди за обраний період."
      />
      <RouteTemplateEditor
        template={toTemplateDTO(template)}
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
