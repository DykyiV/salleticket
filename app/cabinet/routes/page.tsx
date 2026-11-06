import Link from "next/link";
import PageHeader from "@/components/cabinet/PageHeader";
import RouteTemplatesList from "@/components/admin/RouteTemplatesList";
import GtRoutesList from "@/components/admin/GtRoutesList";
import { prisma } from "@/lib/db";
import { toTemplateDTO } from "@/lib/routes/serialize";
import { gtListRoutes } from "@/lib/carriers/grandes-tour/admin";

export const dynamic = "force-dynamic";

export default async function CabinetRoutesPage(props: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const searchParams = await props.searchParams;
  const tab = searchParams?.tab === "gt" ? "gt" : "own";

  const [templates, countries] = await Promise.all([
    prisma.routeTemplate.findMany({
      include: {
        country: true,
        originCountry: true,
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

  const gtRoutes = tab === "gt" ? await gtListRoutes() : [];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Шаблони маршрутів"
        subtitle="Власні шаблони та маршрути від перевізника Grandes Tour."
      />

      {/* Tab switcher */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        <Link
          href="/cabinet/routes?tab=own"
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
            tab === "own"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Власні шаблони
        </Link>
        <Link
          href="/cabinet/routes?tab=gt"
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
            tab === "gt"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Маршрути GT
        </Link>
      </div>

      {tab === "gt" ? (
        <GtRoutesList routes={gtRoutes} />
      ) : (
        <RouteTemplatesList
          initialTemplates={templates.map(toTemplateDTO)}
          initialCountries={countries.map((c) => ({
            id: c.id,
            name: c.name,
            code: c.code,
            templateCount: c._count.templates,
          }))}
        />
      )}
    </div>
  );
}
