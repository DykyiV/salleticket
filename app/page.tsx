import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import SiteFooter from "@/components/site/SiteFooter";
import SearchPanel from "@/components/home/SearchPanel";
import Icon, { isIconName, type IconName } from "@/components/site/Icon";
import { getDict } from "@/lib/i18n/server";
import { fmt, money, plural } from "@/lib/i18n/format";
import type { Lang } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dict";
import { cityLabel, knownCities } from "@/lib/trips/cities";
import { QUICK_ROUTES, getPopularRouteStats, type RouteStats } from "@/lib/site/popularRoutes";
import { REVIEWS } from "@/lib/site/reviews";

export const dynamic = "force-dynamic";

/** Today's date in Central European time (the timetable's zone). */
function todayInEurope(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

function icon(name: string, fallback: IconName = "check"): IconName {
  return isIconName(name) ? name : fallback;
}


export default async function Home() {
  const [{ lang, t }, stats] = await Promise.all([getDict(), getPopularRouteStats().catch(() => [] as RouteStats[])]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Hero t={t} />
        <Benefits t={t} />
        <PopularRoutes t={t} lang={lang} stats={stats} />
        <HowItWorks t={t} />
        <BusTypes t={t} />
        <Reviews t={t} lang={lang} />
        <Faq t={t} />
      </main>
      <SiteFooter />
    </div>
  );
}

function SectionTitle({ title, subtitle, id }: { title: string; subtitle?: string; id?: string }) {
  return (
    <div className="max-w-2xl">
      <h2 id={id} className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">
        {title}
      </h2>
      {subtitle ? <p className="mt-2 text-base text-ink-soft">{subtitle}</p> : null}
    </div>
  );
}

function Hero({ t }: { t: Dict }) {
  return (
    <section id="search" aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-navy">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_85%_-10%,rgba(37,99,235,0.45),transparent),radial-gradient(40rem_24rem_at_0%_110%,rgba(37,99,235,0.25),transparent)]" />
      <div className="container-site pb-10 pt-8 sm:pb-14 sm:pt-12 lg:pb-16 lg:pt-14">
        <div className="grid items-center gap-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
          <div className="order-1 text-white">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-blue-100 ring-1 ring-inset ring-white/15">
              <span className="h-1.5 w-1.5 rounded-full bg-ok" />
              {t.hero.badge}
            </span>
            <h1 id="hero-title" className="mt-4 text-[2rem] font-bold leading-tight tracking-tight sm:text-5xl">
              {t.hero.title}
            </h1>
            <p className="mt-3 max-w-xl text-base text-blue-100/90 sm:text-lg">{t.hero.subtitle}</p>
          </div>
          <div className="order-3 -mx-2 flex justify-center lg:order-2 lg:mx-0">
            <Image
              src="/grandes-tour-bus.webp"
              alt={t.hero.busAlt}
              width={1778}
              height={830}
              priority
              sizes="(min-width: 1024px) 560px, 100vw"
              className="h-auto w-full max-w-md drop-shadow-[0_24px_30px_rgba(0,0,0,0.45)] sm:max-w-lg lg:max-w-none"
            />
          </div>
          <div className="order-2 lg:order-3 lg:col-span-2">
            <SearchPanel cities={knownCities()} quickRoutes={QUICK_ROUTES} today={todayInEurope()} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Benefits({ t }: { t: Dict }) {
  return (
    <section aria-labelledby="benefits-title" className="container-site py-14 sm:py-20">
      <SectionTitle id="benefits-title" title={t.benefits.title} />
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {t.benefits.items.map((b) => (
          <li key={b.title} className="flex gap-4 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-200/70 sm:block sm:p-5">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Icon name={icon(b.icon)} className="h-6 w-6" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-navy sm:mt-4 sm:text-lg">{b.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted sm:mt-1.5">{b.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PopularRoutes({ t, lang, stats }: { t: Dict; lang: Lang; stats: RouteStats[] }) {
  if (!stats.length) return null;
  return (
    <section id="directions" aria-labelledby="routes-title" className="bg-white py-14 sm:py-20">
      <div className="container-site">
        <SectionTitle id="routes-title" title={t.routes.title} subtitle={t.routes.subtitle} />
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((r) => {
            const href = `/results?${new URLSearchParams({ from: r.from, to: r.to, transport: "BUS", tripKind: "ONE_WAY" })}`;
            const frequency = r.perWeek >= 7 ? t.routes.daily : r.perWeek > 0 ? plural(lang, r.perWeek, t.routes.perWeek) : null;
            return (
              <li key={`${r.from}-${r.to}`} className="flex flex-col rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200/70">
                <div className="flex items-center gap-2 text-lg font-semibold text-navy">
                  <span>{cityLabel(r.from, lang)}</span>
                  <Icon name="arrowRight" className="h-4 w-4 shrink-0 text-brand-600" />
                  <span>{cityLabel(r.to, lang)}</span>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm text-ink-muted">
                  {r.hours ? (
                    <li className="flex items-center gap-2">
                      <Icon name="clock" className="h-4 w-4 text-slate-400" />
                      {fmt(t.routes.duration, { h: r.hours })}
                    </li>
                  ) : null}
                  <li className="flex items-center gap-2">
                    <Icon name="calendar" className="h-4 w-4 text-slate-400" />
                    {frequency ?? t.routes.noSchedule}
                  </li>
                </ul>
                <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                  {r.priceFrom != null ? (
                    <p className="text-sm text-ink-soft">
                      {t.common.priceFrom}{" "}
                      <span className="text-2xl font-bold text-navy">{money(r.priceFrom, lang)}</span>
                    </p>
                  ) : (
                    <span />
                  )}
                  <Link href={href} className="btn-secondary shrink-0 px-4 py-2 text-sm">
                    {t.routes.view}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function HowItWorks({ t }: { t: Dict }) {
  return (
    <section aria-labelledby="how-title" className="container-site py-14 sm:py-20">
      <SectionTitle id="how-title" title={t.how.title} />
      <ol className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">
        {t.how.steps.map((step, i) => (
          <li key={step.title} className="flex gap-4 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-200/70 sm:block sm:p-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
              {i + 1}
            </span>
            <div>
              <h3 className="font-semibold text-navy sm:mt-4">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function BusTypes({ t }: { t: Dict }) {
  const amenityIcon: Record<string, IconName> = {
    wifi: "wifi",
    sockets: "sockets",
    ac: "ac",
    wc: "wc",
    water: "water",
    luggage: "luggage",
  };
  const amenities = t.buses.amenities as Record<string, string>;
  return (
    <section aria-labelledby="buses-title" className="bg-white py-14 sm:py-20">
      <div className="container-site">
        <SectionTitle id="buses-title" title={t.buses.title} subtitle={t.buses.subtitle} />
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.buses.items.map((bus) => (
            <li key={bus.id} className="flex flex-col rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200/70">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-white">
                <Icon name="bus" className="h-6 w-6" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-navy">{bus.name}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{bus.text}</p>
              <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={bus.name}>
                {bus.amenities.map((a) => (
                  <li
                    key={a}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-ink-muted ring-1 ring-slate-200"
                  >
                    <Icon name={amenityIcon[a] ?? "check"} className="h-3.5 w-3.5 text-brand-600" />
                    {amenities[a] ?? a}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Reviews({ t, lang }: { t: Dict; lang: Lang }) {
  const reviews = [...REVIEWS].sort((a, b) => Number(b.lang === lang) - Number(a.lang === lang)).slice(0, 6);
  if (!reviews.length) return null;
  return (
    <section aria-labelledby="reviews-title" className="container-site py-14 sm:py-20">
      <SectionTitle id="reviews-title" title={t.reviews.title} />
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((r) => (
          <li key={`${r.name}-${r.date}`} className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-200/70">
            <p className="text-warn" aria-label={`${r.rating}/5`}>
              {"★".repeat(r.rating)}
              <span className="text-slate-200">{"★".repeat(5 - r.rating)}</span>
            </p>
            <blockquote className="mt-3 text-sm leading-relaxed text-ink">{r.text}</blockquote>
            <p className="mt-4 text-sm font-semibold text-navy">{r.name}</p>
            <p className="text-xs text-ink-soft">
              {r.route} · {r.date}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Faq({ t }: { t: Dict }) {
  return (
    <section aria-labelledby="faq-title" className="container-site py-14 sm:py-20">
      <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
        <SectionTitle id="faq-title" title={t.faq.title} />
        <div className="divide-y divide-slate-200 rounded-2xl bg-white shadow-soft ring-1 ring-slate-200/70">
          {t.faq.items.map((item) => (
            <details key={item.q} className="group px-5 py-1 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-semibold text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                {item.q}
                <Icon name="chevronDown" className="h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180" />
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-ink-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
