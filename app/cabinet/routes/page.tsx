import PageHeader from "@/components/cabinet/PageHeader";
import RouteTemplatesList from "@/components/admin/RouteTemplatesList";
import { prisma } from "@/lib/db";
import { toTemplateDTO } from "@/lib/routes/serialize";

export const dynamic = "force-dynamic";

export default async function CabinetRoutesPage() {
  const [templates, countries] = await Promise.all([
    prisma.routeTemplate.findMany({
      include: {
        country: true,
        stops: { orderBy: { sortOrder: "asc" } },
        _count: { select: { departures: true } },
      },
      orderBy: [{ country: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.country.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { templates: true } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Маршрути шаблони"
        subtitle="Країни → маршрути. З шаблону регулярно створюються виїзди на потрібні дні тижня."
      />
      <RouteTemplatesList
        initialTemplates={templates.map(toTemplateDTO)}
        initialCountries={countries.map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          templateCount: c._count.templates,
        }))}
      />
    </div>
  );
}
