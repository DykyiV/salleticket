import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import SiteFooter from "@/components/site/SiteFooter";
import Icon from "@/components/site/Icon";
import StepIndicator from "@/components/checkout/StepIndicator";
import SeatStep from "@/components/checkout/SeatStep";
import { getDict } from "@/lib/i18n/server";
import { money, shortDate } from "@/lib/i18n/format";
import type { Lang } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dict";
import { parseTripKind } from "@/lib/tickets/kinds";
import { cityLabel } from "@/lib/trips/cities";
import { findSearchTrip, tripRefFromParams, tripRefParams, tripStops, type TripStop } from "@/lib/trips/lookup";
import type { Trip } from "@/lib/carriers/types";

export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;

function todayInEurope(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

function count(v?: string): number {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: `${t.seat.metaTitle} — Asol BUS` };
}

export default async function TripPage(props: { searchParams: Promise<SP> }) {
  const sp = await props.searchParams;
  const { t, lang } = await getDict();
  const ref = tripRefFromParams(sp);
  const trip = ref ? await findSearchTrip(ref).catch(() => null) : null;
  const backHref = ref
    ? `/results?${new URLSearchParams({ from: ref.from, to: ref.to, ...(ref.date ? { date: ref.date } : {}), transport: "BUS" })}`
    : "/results";

  const adults = count(sp.adults);
  const children = count(sp.children);
  const seniors = count(sp.seniors);
  const passengers = Math.min(6, Math.max(1, adults + children + seniors || count(sp.passengers) || 1));
  const tripKind = parseTripKind(sp.tripKind);
  const stops = trip && trip.carrierId === "asol" ? await tripStops(trip.id, trip.fromStopIndex, trip.toStopIndex).catch(() => []) : [];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <section className="bg-navy">
        <div className="container-site py-5 sm:py-6">
          <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-blue-200 hover:text-white">
            <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
            {t.seat.back}
          </Link>
          {trip ? <TripHeader trip={trip} t={t} lang={lang} date={ref?.date} /> : null}
          <div className="mt-5">
            <StepIndicator t={t} current={2} />
          </div>
        </div>
      </section>
      <main className="flex-1">
        <div className="container-site py-6 sm:py-8">
          {!trip || !ref ? (
            <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-soft ring-1 ring-slate-200/70">
              <h1 className="text-lg font-semibold text-navy">{t.seat.notFound}</h1>
              <p className="mt-2 text-sm text-ink-muted">{t.seat.notFoundHint}</p>
              <Link href={backHref} className="btn-primary mt-5 px-5 py-2.5 text-sm">
                {t.seat.back}
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <Stops stops={stops} trip={trip} t={t} lang={lang} />
              <SeatStep
                trip={trip}
                tripQuery={tripRefParams({ ...ref, fromStopIndex: trip.fromStopIndex, toStopIndex: trip.toStopIndex }).toString()}
                tripKind={tripKind}
                returnDate={sp.returnDate && /^\d{4}-\d{2}-\d{2}$/.test(sp.returnDate) ? sp.returnDate : undefined}
                passengers={passengers}
                pax={{ adults: adults || (children + seniors ? 0 : passengers), children, seniors }}
                today={todayInEurope()}
              />
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function TripHeader({ trip, t, lang, date }: { trip: Trip; t: Dict; lang: Lang; date?: string }) {
  const r = t.results;
  const busLine = [trip.busCategory ? r.categories[trip.busCategory] : null, trip.busType || null].filter(Boolean).join(" · ");
  const day = trip.departureAt?.slice(0, 10) ?? date;
  return (
    <div className="mt-3 text-white">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
        {cityLabel(trip.from, lang)} → {cityLabel(trip.to, lang)}
      </h1>
      <p className="mt-1 text-sm text-blue-100/90">
        {[day ? shortDate(day, lang) : null, `${trip.departure} – ${trip.arrival}`, trip.carrier, busLine || null, `${money(trip.price, lang)} ${r.card.perPassenger}`]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </div>
  );
}

function Stops({ stops, trip, t, lang }: { stops: TripStop[]; trip: Trip; t: Dict; lang: Lang }) {
  const first = stops[0];
  const last = stops[stops.length - 1];
  const time = (iso: string) => iso.slice(11, 16);
  const rows: { label: string; city: string; address: string | null; at: string | null }[] = first
    ? [
        { label: t.seat.boarding, city: first.city, address: first.address, at: time(first.at) },
        ...stops.slice(1, -1).map((s) => ({ label: "", city: s.city, address: s.address, at: time(s.at) })),
        { label: t.seat.dropoff, city: last.city, address: last.address, at: time(last.at) },
      ]
    : [
        { label: t.seat.boarding, city: trip.from, address: trip.fromStation ?? null, at: trip.departure },
        { label: t.seat.dropoff, city: trip.to, address: trip.toStation ?? null, at: trip.arrival },
      ];
  return (
    <details className="group rounded-2xl bg-white shadow-soft ring-1 ring-slate-200/70 [&_summary::-webkit-details-marker]:hidden" open={rows.length <= 4}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-semibold text-navy">
        <span className="inline-flex items-center gap-2">
          <Icon name="pin" className="h-5 w-5 text-brand-600" />
          {t.seat.stops}
        </span>
        <Icon name="chevronDown" className="h-5 w-5 text-slate-400 transition group-open:rotate-180" />
      </summary>
      <ol className="px-5 pb-5">
        {rows.map((row, i) => {
          const edge = i === 0 || i === rows.length - 1;
          return (
            <li key={`${row.city}-${i}`} className="relative flex gap-4 pb-4 last:pb-0">
              {i < rows.length - 1 ? <span aria-hidden="true" className="absolute left-[3.85rem] top-5 h-full w-0.5 bg-brand-100" /> : null}
              <span className="w-12 shrink-0 pt-0.5 text-right text-sm font-semibold tabular-nums text-navy">{row.at}</span>
              <span
                aria-hidden="true"
                className={`relative z-10 mt-1.5 h-3 w-3 shrink-0 rounded-full ${edge ? "bg-brand-600 ring-4 ring-brand-100" : "border-2 border-brand-300 bg-white"}`}
              />
              <span className="min-w-0">
                {row.label ? <span className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">{row.label}</span> : null}
                <span className={`block ${edge ? "font-semibold text-navy" : "text-ink-muted"}`}>{cityLabel(row.city, lang)}</span>
                {row.address ? <span className="block text-sm text-ink-soft">{row.address}</span> : edge && i === 0 ? <span className="block text-sm text-ink-soft">{t.seat.noStops}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </details>
  );
}
