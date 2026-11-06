import Link from "next/link";
import PageHeader from "@/components/cabinet/PageHeader";
import RouteTemplatesList from "@/components/admin/RouteTemplatesList";
import { prisma } from "@/lib/db";
import { toTemplateDTO } from "@/lib/routes/serialize";
import { gtListRoutes, type GtRoute } from "@/lib/carriers/grandes-tour/admin";
import { flagEmoji } from "@/lib/routes/countries";
import { weekdayShortByName } from "@/lib/routes/weekdays";

export const dynamic = "force-dynamic";

/** Departure days of a carrier's route: "Чт / Нд · Ср / Сб" (there / back). */
function days(route: GtRoute): string {
  if (!route.schedule.length) return "—";
  return route.schedule.map((d) => `${weekdayShortByName(d.there)} / ${weekdayShortByName(d.back)}`).join(" · ");
}

/** All routes on one page, by carrier: names and departure days; the details open on the route's page. */
export default async function CabinetRoutesPage() {
  const [templates, countries, gtRoutes] = await Promise.all([
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
    gtListRoutes(),
  ]);

  const carriers = new Map<string, GtRoute[]>();
  for (const r of gtRoutes) carriers.set(r.carrierName, [...(carriers.get(r.carrierName) ?? []), r]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="Маршрути" subtitle="Усі маршрути за перевізниками: назва й дні виїзду. Натисніть на маршрут — зупинки, час і адреси." />

      {[...carriers.entries()].map(([carrier, routes]) => (
        <section key={carrier} className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          <header className="flex items-baseline justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-900">{carrier}</h2>
            <span className="text-xs text-slate-500">маршрутів: {routes.length}</span>
          </header>
          <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-slate-100 px-4 py-2 text-[11px] uppercase tracking-wide text-slate-500 sm:grid">
            <span>Маршрут</span>
            <span>Дні виїзду (туди / назад)</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {[...routes]
              .sort((a, b) => (a.countryIso ?? "").localeCompare(b.countryIso ?? "") || a.name.localeCompare(b.name, "uk"))
              .map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/cabinet/routes/gt-${r.id}`}
                    className="grid gap-1 px-4 py-2.5 text-sm hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-3"
                  >
                    <span className="font-medium text-brand-700">
                      <span className="mr-1.5" aria-hidden="true">
                        {r.countryIso ? flagEmoji(r.countryIso) : "🚌"}
                      </span>
                      {r.name.replace(/\s+-\s+/g, " — ")}
                      {r.comment && r.comment.toUpperCase() !== carrier.toUpperCase() ? (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">{r.comment}</span>
                      ) : null}
                    </span>
                    <span className="text-slate-700">{days(r)}</span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-900">Kaufmann Reisen — власні маршрути</h2>
        <RouteTemplatesList
          initialTemplates={templates.map(toTemplateDTO)}
          initialCountries={countries.map((c) => ({
            id: c.id,
            name: c.name,
            code: c.code,
            templateCount: c._count.templates,
          }))}
        />
      </section>
    </div>
  );
}
