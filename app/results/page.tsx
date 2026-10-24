import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import SiteFooter from "@/components/site/SiteFooter";
import Icon from "@/components/site/Icon";
import ResultsView from "@/components/results/ResultsView";
import SearchSummary from "@/components/results/SearchSummary";
import { searchAllCarriers } from "@/lib/carriers/registry";
import type { Trip, TransportType } from "@/lib/carriers/types";
import { getDict } from "@/lib/i18n/server";
import { fmt, plural, shortDate } from "@/lib/i18n/format";
import type { Lang } from "@/lib/i18n/config";
import { parseTripKind } from "@/lib/tickets/kinds";
import { getSiteSettings } from "@/lib/settings";
import { onlinePaymentsEnabled } from "@/lib/paymentMode";
import { cityLabel, knownCities } from "@/lib/trips/cities";
import { filtersFromParams } from "@/lib/results/filter";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | undefined>;

const MAX_PASSENGERS = 6;
const TRANSPORTS: TransportType[] = ["BUS", "FLIGHT", "TRAIN"];

function todayInEurope(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function count(v: string | undefined): number {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function passengerCounts(sp: SearchParams) {
  const adults = count(sp.adults);
  const children = count(sp.children);
  const seniors = count(sp.seniors);
  const sum = adults + children + seniors;
  const total = Math.min(MAX_PASSENGERS, Math.max(1, sum || count(sp.passengers) || 1));
  return sum ? { adults, children, seniors, total } : { adults: total, children: 0, seniors: 0, total };
}

export async function generateMetadata(props: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const sp = await props.searchParams;
  const { t, lang } = await getDict();
  if (!sp.from || !sp.to) return { title: `${t.nav.trips} — Asol BUS` };
  return {
    title: `${fmt(t.results.metaTitle, { from: cityLabel(sp.from, lang), to: cityLabel(sp.to, lang) })} — Asol BUS`,
  };
}

export default async function ResultsPage(props: { searchParams: Promise<SearchParams> }) {
  const sp = await props.searchParams;
  const [{ t, lang }, settings] = await Promise.all([getDict(), getSiteSettings()]);
  const r = t.results;

  const from = sp.from?.trim() || "";
  const to = sp.to?.trim() || "";
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : undefined;
  const tripKind = parseTripKind(sp.tripKind);
  const returnDate = sp.returnDate && /^\d{4}-\d{2}-\d{2}$/.test(sp.returnDate) ? sp.returnDate : undefined;
  const pax = passengerCounts(sp);
  const transportRaw = sp.transport?.toUpperCase() as TransportType | undefined;
  const transport = transportRaw && TRANSPORTS.includes(transportRaw) ? transportRaw : "BUS";
  const today = todayInEurope();
  const { filters, sort } = filtersFromParams(sp);

  let trips: Trip[] = [];
  let partial = false;
  if (from && to) {
    const results = await searchAllCarriers({ from, to, date, passengers: pax.total, transport });
    trips = results.flatMap((x) => x.trips);
    partial = results.some((x) => x.error);
  }

  const routeTitle = from && to ? `${cityLabel(from, lang)} → ${cityLabel(to, lang)}` : t.nav.trips;
  const hasRoute = Boolean(from && to);
  const details = !hasRoute ? r.pickRoute : [
    date ? shortDate(date, lang) : r.anyDate,
    tripKind === "ROUND_TRIP" && returnDate
      ? fmt(r.returnOn, { date: shortDate(returnDate, lang) })
      : tripKind !== "ONE_WAY"
        ? r.openReturn
        : null,
    plural(lang, pax.total, t.search.passengersCount),
  ]
    .filter(Boolean)
    .join(" · ");

  const onlineDiscount = onlinePaymentsEnabled() ? settings.onlineDiscountPercent : 0;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <section className="bg-navy">
        <div className="container-site py-5 sm:py-6">
          <SearchSummary
            title={routeTitle}
            details={details}
            cities={knownCities()}
            today={today}
            initiallyOpen={!hasRoute}
            defaults={{
              from,
              to,
              date,
              returnDate,
              roundTrip: tripKind !== "ONE_WAY",
              pax: { adults: pax.adults, children: pax.children, seniors: pax.seniors },
            }}
          />
          {date && hasRoute ? <DateStrip sp={sp} date={date} today={today} lang={lang} prev={r.prevDay} next={r.nextDay} /> : null}
        </div>
      </section>

      <main className="flex-1">
        <div className="container-site py-6 sm:py-8">
          {partial ? (
            <p role="status" className="mb-4 rounded-xl bg-warn-50 px-4 py-3 text-sm text-warn-700 ring-1 ring-warn-100">
              {r.carriersFailed}
            </p>
          ) : null}
          {!hasRoute ? null : trips.length === 0 ? (
            <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-soft ring-1 ring-slate-200/70">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <Icon name="bus" className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-navy">{r.noResults}</h2>
              <p className="mt-2 text-sm text-ink-muted">{r.noResultsHint}</p>
              <Link href="/#search" className="btn-primary mt-5 px-5 py-2.5 text-sm">
                {r.editSearch}
              </Link>
            </div>
          ) : (
            <ResultsView
              trips={trips}
              from={from}
              to={to}
              pax={{ adults: pax.adults, children: pax.children, seniors: pax.seniors }}
              initialFilters={filters}
              initialSort={sort}
              passengers={pax.total}
              onlineDiscountPercent={onlineDiscount}
              date={date}
              tripKind={tripKind}
              returnDate={returnDate}
            />
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

/** Previous / next day and a week of dates around the chosen one. */
function DateStrip({
  sp,
  date,
  today,
  lang,
  prev,
  next,
}: {
  sp: SearchParams;
  date: string;
  today: string;
  lang: Lang;
  prev: string;
  next: string;
}) {
  const hrefFor = (d: string) => {
    const params = new URLSearchParams(
      Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string")
    );
    params.set("date", d);
    if (params.get("returnDate") && params.get("returnDate")! < d) params.delete("returnDate");
    return `/results?${params.toString()}`;
  };
  const start = addDays(date, -3) < today ? today : addDays(date, -3);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const prevDay = addDays(date, -1);
  return (
    <nav aria-label="dates" className="mt-4 flex items-center gap-2">
      {prevDay >= today ? (
        <Link href={hrefFor(prevDay)} aria-label={prev} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/20">
          <Icon name="chevronRight" className="h-5 w-5 rotate-180" />
        </Link>
      ) : (
        <span className="h-11 w-11 shrink-0" />
      )}
      <ul className="flex flex-1 justify-center gap-2 overflow-x-auto [scrollbar-width:none] sm:justify-start">
        {days.map((d, i) => {
          const current = d === date;
          // Phones show the chosen day and its neighbours; wider screens the week.
          const near = Math.abs(i - days.indexOf(date)) <= 1;
          const [weekday, ...rest] = shortDate(d, lang).split(/,?\s+/);
          return (
            <li key={d} className={`shrink-0 ${near ? "" : "hidden sm:block"}`}>
              <Link
                href={hrefFor(d)}
                aria-current={current ? "date" : undefined}
                className={`flex min-w-[4.5rem] flex-col items-center rounded-xl px-3 py-1.5 text-sm transition ${
                  current ? "bg-white font-semibold text-navy" : "bg-white/5 text-blue-100 ring-1 ring-white/10 hover:bg-white/15"
                }`}
              >
                <span className="text-xs capitalize opacity-80">{weekday}</span>
                <span className="whitespace-nowrap">{rest.join(" ")}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link href={hrefFor(addDays(date, 1))} aria-label={next} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/20">
        <Icon name="chevronRight" className="h-5 w-5" />
      </Link>
    </nav>
  );
}
