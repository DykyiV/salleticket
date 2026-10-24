import Icon from "@/components/site/Icon";
import type { Lang } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dict";
import { fmt, longDate, money } from "@/lib/i18n/format";
import type { ETicket, ETicketJourney, ETicketState } from "@/lib/tickets/eTicket";
import { cityLabel } from "@/lib/trips/cities";

export const STATE_PILL: Record<ETicketState, string> = {
  due: "bg-warn-50 text-warn-700 ring-warn-100",
  pending: "bg-brand-50 text-brand-700 ring-brand-100",
  paid: "bg-ok-50 text-ok-700 ring-ok-100",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-100",
  refunded: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function StatePill({ state, t }: { state: ETicketState; t: Dict }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STATE_PILL[state]}`}>
      {state === "paid" ? <Icon name="check" className="h-3.5 w-3.5" /> : null}
      {t.ticket.status[state]}
    </span>
  );
}

export function ageLabel(t: Dict, category: string): string {
  const label = t.checkout.ageCategory[category as keyof Dict["checkout"]["ageCategory"]];
  return label ? label.split(" · ")[0] : category;
}

function Journey({ j, t, lang }: { j: ETicketJourney; t: Dict; lang: Lang }) {
  const tt = t.ticket;
  const rows = [
    { label: tt.boarding, time: j.departAt?.slice(11, 16), city: j.from, address: j.boardAddress, map: j.boardMap },
    { label: tt.dropoff, time: j.arriveAt?.slice(11, 16), city: j.to, address: j.alightAddress, map: j.alightMap },
  ];
  const nextDay = j.departAt && j.arriveAt && j.arriveAt.slice(0, 10) > j.departAt.slice(0, 10);
  return (
    <section aria-label={j.kind === "return" ? tt.return : tt.outbound}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand-700">
          {j.kind === "return" ? tt.return : tt.outbound}
        </span>
        {j.departAt ? <span className="text-sm font-semibold text-navy first-letter:uppercase">{longDate(j.departAt, lang)}</span> : null}
      </div>
      <ol className="mt-3">
        {rows.map((row, i) => (
          <li key={row.label} className="relative flex gap-3 pb-4 last:pb-0">
            {i === 0 ? <span aria-hidden="true" className="absolute left-[4.56rem] top-6 h-[calc(100%-1rem)] w-0.5 bg-brand-100" /> : null}
            <span className="w-14 shrink-0 whitespace-nowrap pt-0.5 text-right text-base font-bold tabular-nums text-navy">
              {row.time ?? "—"}
              {i === 1 && nextDay ? <sup className="ml-0.5 text-[10px] font-semibold text-warn-700">+1</sup> : null}
            </span>
            <span aria-hidden="true" className="relative z-10 mt-2 h-3 w-3 shrink-0 rounded-full bg-brand-600 ring-4 ring-brand-100" />
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{row.label}</span>
              <span className="block font-semibold text-navy">{cityLabel(row.city, lang)}</span>
              {row.address ? <span className="block text-sm text-ink-muted">{row.address}</span> : null}
              {row.map ? (
                <a href={row.map} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
                  <Icon name="pin" className="h-3.5 w-3.5" />
                  {tt.map}
                </a>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
      <ul className="mt-3 flex flex-wrap gap-2 text-sm">
        <li className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 ring-1 ring-slate-200/70">
          <Icon name="seat" className="h-4 w-4 text-brand-600" />
          <span className="text-ink-muted">{tt.seat}:</span>
          <span className="font-semibold text-navy">{j.freeSeating ? tt.noSeat : fmt(tt.seatN, { n: j.seat ?? "" })}</span>
        </li>
        <li className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 ring-1 ring-slate-200/70">
          <Icon name="bus" className="h-4 w-4 text-brand-600" />
          <span className="text-ink-muted">{tt.bus}:</span>
          <span className="font-semibold text-navy">{j.bus ?? tt.busTbd}</span>
        </li>
        {j.carrier ? (
          <li className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 ring-1 ring-slate-200/70">
            <span className="text-ink-muted">{tt.carrier}:</span>
            <span className="font-semibold text-navy">{j.carrier}</span>
          </li>
        ) : null}
      </ul>
      {j.legs.length ? (
        <ul className="mt-3 space-y-1 rounded-xl border border-dashed border-slate-300 p-3 text-sm">
          {j.legs.map((leg, i) => (
            <li key={`${leg.from}-${i}`} className="flex flex-wrap gap-x-2 text-ink-muted">
              <span className="font-semibold text-navy">
                {cityLabel(leg.from, lang)} → {cityLabel(leg.to, lang)}
              </span>
              <span>
                · {tt.seat} {leg.seat != null ? fmt(tt.seatN, { n: leg.seat }) : tt.noSeat}
              </span>
              {leg.bus ? <span>· {leg.bus}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Passenger e-ticket card: QR, route with boarding addresses, seat, price. */
export default function ETicketCard({ e, qr, t, lang }: { e: ETicket; qr: string; t: Dict; lang: Lang }) {
  const tt = t.ticket;
  const void_ = e.state === "cancelled" || e.state === "refunded";
  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-200/70" aria-label={`${tt.reference} ${e.reference}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 bg-navy px-5 py-3 text-white">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-blue-200">{tt.reference}</p>
          <p className="font-mono text-lg font-bold tracking-widest">{e.reference}</p>
        </div>
        <StatePill state={e.state} t={t} />
      </header>

      <div className="grid gap-6 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-6">
        <div className="min-w-0 space-y-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{tt.passenger}</p>
            <p className="text-lg font-bold text-navy">
              {e.firstName} {e.lastName}
            </p>
            <p className="text-sm text-ink-muted">{ageLabel(t, e.ageCategory)}</p>
          </div>
          {e.journeys.map((j) => (
            <Journey key={j.kind} j={j} t={t} lang={lang} />
          ))}
          {e.openReturn && !e.journeys.some((j) => j.kind === "return") ? (
            <p className="inline-flex rounded-md bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">{tt.openReturn}</p>
          ) : null}
        </div>

        <div
          className={`order-first flex flex-col items-center gap-2 border-b border-dashed border-slate-200 pb-5 sm:order-none sm:border-b-0 sm:border-l sm:pb-0 sm:pl-6 ${
            void_ ? "opacity-40" : ""
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`QR ${e.reference}`} width={176} height={176} className="h-44 w-44 rounded-lg bg-white p-1 ring-1 ring-slate-200" />
          <p className="font-mono text-sm font-bold tracking-widest text-navy">{e.reference}</p>
          <p className="max-w-[11rem] text-center text-xs text-ink-muted">{tt.qrHint}</p>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
        <p className="text-sm text-ink-muted">
          {tt.price}: <span className="text-base font-bold tabular-nums text-navy">{money(e.price, lang)}</span>
        </p>
        {e.state === "paid" ? (
          <p className="inline-flex items-center gap-1 text-sm font-semibold text-ok-700">
            <Icon name="check" className="h-4 w-4" />
            {tt.paid}
          </p>
        ) : e.toPay > 0 ? (
          <p className="text-sm font-semibold text-warn-700">
            {e.state === "due" ? tt.toPay : tt.status.pending}: <span className="tabular-nums">{money(e.toPay, lang)}</span>
          </p>
        ) : null}
      </footer>
    </article>
  );
}
