"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import Icon from "@/components/site/Icon";
import { fmt, plural, useI18n } from "@/lib/i18n/client";
import { cityLabel, cityNames } from "@/lib/trips/cities";

/** Same cap as the booking API (MAX_PASSENGERS). */
const MAX_PASSENGERS = 6;

type Pax = { adults: number; children: number; seniors: number };

export type SearchDefaults = {
  from?: string;
  to?: string;
  date?: string;
  returnDate?: string;
  roundTrip?: boolean;
  pax?: Partial<Pax>;
};

/**
 * Hero search: one way / return, from → to with swap, dates and a passenger
 * picker (adults, children, concession). Submits to /results.
 */
export default function SearchPanel({
  cities,
  quickRoutes,
  today,
  defaults = {},
}: {
  /** Ukrainian city names for suggestions. */
  cities: string[];
  quickRoutes: { from: string; to: string }[];
  /** YYYY-MM-DD from the server — earliest selectable date. */
  today: string;
  defaults?: SearchDefaults;
}) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const s = t.search;
  const listId = useId();
  const [roundTrip, setRoundTrip] = useState(Boolean(defaults.roundTrip));
  const [from, setFrom] = useState(defaults.from ? cityLabel(defaults.from, lang) : "");
  const [to, setTo] = useState(defaults.to ? cityLabel(defaults.to, lang) : "");
  const [date, setDate] = useState(defaults.date ?? "");
  const [returnDate, setReturnDate] = useState(defaults.returnDate ?? "");
  const [pax, setPax] = useState<Pax>({ adults: 1, children: 0, seniors: 0, ...defaults.pax });
  const [error, setError] = useState<string | null>(null);
  const minDate = today;
  const [submitting, setSubmitting] = useState(false);

  const total = pax.adults + pax.children + pax.seniors;

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const pickRoute = (r: { from: string; to: string }) => {
    setFrom(cityLabel(r.from, lang));
    setTo(cityLabel(r.to, lang));
    setError(null);
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = from.trim();
    const tt = to.trim();
    if (!f || !tt) return setError(s.errorCities);
    if (cityNames(f).map((x) => x.toLowerCase()).includes(tt.toLowerCase())) return setError(s.errorSameCity);
    if (roundTrip && returnDate && date && returnDate < date) return setError(s.errorReturn);
    setError(null);
    setSubmitting(true);
    const params = new URLSearchParams({ from: f, to: tt, transport: "BUS" });
    if (date) params.set("date", date);
    if (roundTrip) {
      params.set("tripKind", returnDate ? "ROUND_TRIP" : "OPEN_RETURN");
      if (returnDate) params.set("returnDate", returnDate);
    } else {
      params.set("tripKind", "ONE_WAY");
    }
    params.set("passengers", String(total));
    params.set("adults", String(pax.adults));
    if (pax.children) params.set("children", String(pax.children));
    if (pax.seniors) params.set("seniors", String(pax.seniors));
    router.push(`/results?${params.toString()}`);
  };

  return (
    <form
      onSubmit={submit}
      aria-label={s.title}
      noValidate
      className="w-full rounded-3xl bg-white p-3 text-ink shadow-lift ring-1 ring-slate-200/70 sm:p-5"
    >
      <div role="radiogroup" aria-label={s.title} className="mb-3 inline-flex rounded-xl bg-slate-100 p-1">
        {[
          { value: false, label: s.oneWay },
          { value: true, label: s.roundTrip },
        ].map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={roundTrip === opt.value}
            onClick={() => setRoundTrip(opt.value)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              roundTrip === opt.value ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto]">
        <div className="relative grid grid-cols-1 gap-2 sm:col-span-2 sm:grid-cols-2">
          <Box label={s.from} icon="pin" htmlFor="search-from">
            <input
              id="search-from"
              name="from"
              list={listId}
              autoComplete="off"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder={s.cityPlaceholder}
              className="w-full bg-transparent pr-10 text-base font-semibold text-navy placeholder:text-[0.9375rem] placeholder:font-normal placeholder:text-slate-400 focus:outline-none sm:pr-4"
            />
          </Box>
          <button
            type="button"
            onClick={swap}
            aria-label={s.swap}
            title={s.swap}
            className="absolute right-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 rotate-90 items-center justify-center rounded-full border border-slate-200 bg-white text-brand-600 shadow-sm transition hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:rotate-0"
          >
            <Icon name="swap" className="h-4 w-4" />
          </button>
          <Box label={s.to} icon="pin" htmlFor="search-to">
            <input
              id="search-to"
              name="to"
              list={listId}
              autoComplete="off"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={s.cityPlaceholder}
              className="w-full bg-transparent pr-10 text-base font-semibold text-navy placeholder:text-[0.9375rem] placeholder:font-normal placeholder:text-slate-400 focus:outline-none sm:pl-4 sm:pr-0"
            />
          </Box>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:col-span-2">
          <Box label={s.departDate} icon="calendar" htmlFor="search-date">
            <input
              id="search-date"
              type="date"
              name="date"
              min={minDate}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full min-w-0 bg-transparent text-base font-semibold text-navy focus:outline-none"
            />
          </Box>
          {roundTrip ? (
            <Box label={s.returnDate} icon="calendar" htmlFor="search-return">
              <input
                id="search-return"
                type="date"
                name="returnDate"
                min={date || minDate}
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                aria-describedby="search-return-hint"
                className="w-full min-w-0 bg-transparent text-base font-semibold text-navy focus:outline-none"
              />
              <span id="search-return-hint" className="sr-only">
                {s.returnHint}
              </span>
            </Box>
          ) : (
            <button
              type="button"
              onClick={() => setRoundTrip(true)}
              className="flex min-h-[3.75rem] items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-3 text-left text-sm font-medium text-slate-500 transition hover:border-brand-400 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Icon name="plus" className="h-4 w-4 shrink-0" />
              <span className="leading-tight">{s.returnDate}</span>
            </button>
          )}
        </div>

        <PassengerPicker pax={pax} setPax={setPax} total={total} />

        <button type="submit" disabled={submitting} className="btn-primary min-h-[3.75rem] w-full rounded-2xl px-6 text-base xl:w-auto">
          <Icon name="search" className="h-5 w-5" />
          {s.submit}
        </button>
      </div>

      <p role="alert" aria-live="polite" className={`text-sm font-medium text-rose-700 ${error ? "mt-3" : "sr-only"}`}>
        {error ?? ""}
      </p>

      <datalist id={listId}>
        {cities.map((c) => (
          <option key={c} value={cityLabel(c, lang)} />
        ))}
      </datalist>

      {quickRoutes.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">{s.popular}</span>
          {quickRoutes.map((r) => (
            <button
              key={`${r.from}-${r.to}`}
              type="button"
              onClick={() => pickRoute(r)}
              className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-navy transition hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {cityLabel(r.from, lang)} — {cityLabel(r.to, lang)}
            </button>
          ))}
        </div>
      ) : null}
    </form>
  );
}

function Box({ label, icon, htmlFor, children }: { label: string; icon: "pin" | "calendar"; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[3.75rem] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
      {/* Date inputs bring their own calendar icon. */}
      {icon === "calendar" ? null : <Icon name={icon} className="h-5 w-5 shrink-0 text-slate-400" />}
      <div className="min-w-0 flex-1 py-2">
        <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-500">
          {label}
        </label>
        {children}
      </div>
    </div>
  );
}

function PassengerPicker({ pax, setPax, total }: { pax: Pax; setPax: (p: Pax) => void; total: number }) {
  const { t, lang } = useI18n();
  const s = t.search;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const rows: { key: keyof Pax; label: string; hint: string; min: number }[] = [
    { key: "adults", label: s.adults, hint: s.adultsHint, min: 0 },
    { key: "children", label: s.children, hint: s.childrenHint, min: 0 },
    { key: "seniors", label: s.seniors, hint: s.seniorsHint, min: 0 },
  ];

  const change = (key: keyof Pax, delta: number) => {
    const next = { ...pax, [key]: Math.max(0, pax[key] + delta) };
    const sum = next.adults + next.children + next.seniors;
    if (sum < 1 || sum > MAX_PASSENGERS) return;
    setPax(next);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[3.75rem] w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 text-left transition hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Icon name="users" className="h-5 w-5 shrink-0 text-slate-400" />
        <span className="min-w-0 flex-1 py-2">
          <span className="block text-xs font-medium text-slate-500">{s.passengers}</span>
          <span className="block truncate text-base font-semibold text-navy">{plural(lang, total, s.passengersCount)}</span>
        </span>
        <Icon name="chevronDown" className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div
          id={panelId}
          className="absolute left-0 right-0 z-30 mt-2 rounded-2xl bg-white p-4 shadow-lift ring-1 ring-slate-200 lg:left-auto lg:w-80"
        >
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.key} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-navy">{r.label}</p>
                  <p className="text-xs text-slate-500">{r.hint}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Stepper label={`${s.decrease}: ${r.label}`} icon="minus" onClick={() => change(r.key, -1)} disabled={pax[r.key] <= r.min || total <= 1} />
                  <span className="w-5 text-center text-base font-semibold tabular-nums" aria-live="polite">
                    {pax[r.key]}
                  </span>
                  <Stepper label={`${s.increase}: ${r.label}`} icon="plus" onClick={() => change(r.key, 1)} disabled={total >= MAX_PASSENGERS} />
                </div>
              </li>
            ))}
          </ul>
          {total >= MAX_PASSENGERS ? (
            <p className="mt-3 text-xs text-warn-700">{fmt(s.maxPassengers, { n: MAX_PASSENGERS })}</p>
          ) : null}
          <button type="button" onClick={() => setOpen(false)} className="btn-primary mt-4 w-full py-2.5 text-sm">
            {s.done}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Stepper({ label, icon, onClick, disabled }: { label: string; icon: "plus" | "minus"; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-navy transition hover:border-brand-400 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}
