import Header from "@/components/Header";
import AdminShell from "@/components/admin/AdminShell";
import RouteTemplatesList from "@/components/admin/RouteTemplatesList";
import { prisma } from "@/lib/db";
import { toTemplateDTO } from "@/lib/routes/serialize";

export const dynamic = "force-dynamic";

export default async function RouteTemplatesPage() {
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
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <AdminShell
          wide
          title="Шаблон маршрутів"
          subtitle="Країни → маршрути. З шаблону потім регулярно створюються виїзди на потрібні дні тижня."
        >
          <RouteTemplatesList
            initialTemplates={templates.map(toTemplateDTO)}
            initialCountries={countries.map((c) => ({
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
