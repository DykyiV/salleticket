import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/cabinet/PageHeader";
import { gtRouteDetail } from "@/lib/carriers/grandes-tour/admin";
import { flagEmoji } from "@/lib/routes/countries";
import { weekdayShortByName } from "@/lib/routes/weekdays";
import RouteTemplateEditor from "@/components/admin/RouteTemplateEditor";
import { prisma } from "@/lib/db";
import { toTemplateDTO } from "@/lib/routes/serialize";

export const dynamic = "force-dynamic";

export default async function EditCabinetRoutePage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const gt = /^gt-(\d+)$/.exec(params.id);
  if (gt) return <GtRoutePage id={Number(gt[1])} />;
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

const day = (name?: string) => (name ? weekdayShortByName(name) : "");

/** A carrier's route: every schedule with its stops, boarding points, days and times there and back. */
async function GtRoutePage({ id }: { id: number }) {
  const route = await gtRouteDetail(id);
  if (!route) notFound();
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <Link href="/cabinet/routes" className="text-sm text-brand-700 hover:underline">
        ← Усі маршрути
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            <span className="mr-2" aria-hidden="true">
              {route.countryIso ? flagEmoji(route.countryIso) : "🚌"}
            </span>
            {route.name.replace(/\s+-\s+/g, " — ")}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {route.carrierName}
            {route.countryName ? ` · ${route.countryName}` : ""}
            {route.comment && route.comment.toUpperCase() !== route.carrierName.toUpperCase() ? ` · ${route.comment}` : ""}
            {" · "}дні виїзду (туди / назад):{" "}
            {route.schedule.map((d) => `${day(d.there)} / ${day(d.back)}`).join(" · ") || "—"}
          </p>
        </div>
        <Link
          href={`/cabinet/departures?route=gt-${route.id}`}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          Найближчі виїзди →
        </Link>
      </header>

      {route.schedules.map((sch, i) => (
        <section key={`${sch.title}-${i}`} className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
            Розклад {sch.title ? `«${sch.title}»` : i + 1} · зупинок: {sch.stops.length}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Місто</th>
                  <th className="px-4 py-2">Місце посадки</th>
                  <th className="px-4 py-2">Туди</th>
                  <th className="px-4 py-2">Назад</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sch.stops.map((s, n) => (
                  <tr key={`${s.city}-${n}`}>
                    <td className="px-4 py-2 text-slate-400">{n + 1}</td>
                    <td className="px-4 py-2 font-medium text-slate-900">{s.city}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {s.map ? (
                        <a href={s.map} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
                          {s.place ?? "на карті"}
                        </a>
                      ) : (
                        (s.place ?? "—")
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-slate-700">
                      {s.thereTime ? `${day(s.thereDay)} ${s.thereTime}` : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-slate-700">
                      {s.backTime ? `${day(s.backDay)} ${s.backTime}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
