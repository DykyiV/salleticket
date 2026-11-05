"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/site/Icon";
import { useI18n } from "@/lib/i18n/client";
import { localeOf, longDate, money } from "@/lib/i18n/format";
import { cityNames } from "@/lib/trips/cities";

const monthOf = (day: string) => day.slice(0, 7);
const addMonths = (month: string, n: number) => {
  const d = new Date(`${month}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};

/** Lowest fares per day, shared by every picker on the page. */
const priceCache = new Map<string, Promise<Record<string, number>>>();
function loadPrices(from: string, to: string, month: string): Promise<Record<string, number>> {
  const key = `${from}|${to}|${month}`;
  if (!priceCache.has(key)) {
    const q = new URLSearchParams({ from, to, month });
    priceCache.set(
      key,
      fetch(`/api/calendar?${q}`)
        .then((r) => (r.ok ? r.json() : { prices: {} }))
        .then((d: { prices?: Record<string, number> }) => d.prices ?? {})
        .catch(() => {
          priceCache.delete(key);
          return {};
        }),
    );
  }
  return priceCache.get(key)!;
}

/**
 * Date field with a month calendar: days with trips on the route are
 * highlighted with the lowest fare («від 81 €»).
 */
export default function DatePicker({
  id,
  value,
  onChange,
  min,
  from,
  to,
  align = "left",
}: {
  id: string;
  value: string;
  onChange: (day: string) => void;
  /** YYYY-MM-DD, earliest selectable day. */
  min: string;
  /** Route as typed (any language); prices show once both are known cities. */
  from: string;
  to: string;
  align?: "left" | "right";
}) {
  const { t, lang } = useI18n();
  const s = t.search;
  const locale = localeOf(lang);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(monthOf(value || min));
  const [loaded, setLoaded] = useState<{ key: string; prices: Record<string, number> } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const fromCity = cityNames(from)[0] ?? "";
  const toCity = cityNames(to)[0] ?? "";
  const routeKnown = Boolean(fromCity && toCity && fromCity !== toCity && from.trim() && to.trim());

  // Lowest prices of the month shown, for this route only.
  const priceKey = routeKnown ? `${fromCity}|${toCity}|${view}` : "";
  useEffect(() => {
    if (!open || !priceKey) return;
    let alive = true;
    void loadPrices(fromCity, toCity, view).then((p) => {
      if (alive) setLoaded({ key: priceKey, prices: p });
    });
    return () => {
      alive = false;
    };
  }, [open, priceKey, fromCity, toCity, view]);
  const prices = loaded && loaded.key === priceKey ? loaded.prices : {};
  const loading = open && Boolean(priceKey) && loaded?.key !== priceKey;

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

  const first = new Date(`${view}-01T12:00:00Z`);
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${view}-${String(i + 1).padStart(2, "0")}`),
  ];
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + i))),
  );
  const monthName = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const title = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const canPrev = view > monthOf(min);

  return (
    <div ref={ref} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setView(monthOf(value || min));
          setOpen((o) => !o);
        }}
        className={`block w-full truncate text-left text-base font-semibold focus:outline-none ${value ? "text-navy" : "font-normal text-slate-400"}`}
      >
        {value ? longDate(value, lang, { weekday: "short", year: false }) : s.pickDate}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={title}
          className={`absolute top-full z-40 mt-3 w-[min(21rem,calc(100vw-2rem))] rounded-2xl bg-white p-3 shadow-lift ring-1 ring-slate-200 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setView(addMonths(view, -1))}
              disabled={!canPrev}
              aria-label={s.prevMonth}
              className="flex h-9 w-9 items-center justify-center rounded-full text-navy hover:bg-slate-100 disabled:opacity-30"
            >
              <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
            </button>
            <p className="text-sm font-semibold text-navy">{title}</p>
            <button
              type="button"
              onClick={() => setView(addMonths(view, 1))}
              aria-label={s.nextMonth}
              className="flex h-9 w-9 items-center justify-center rounded-full text-navy hover:bg-slate-100"
            >
              <Icon name="chevronRight" className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-slate-400">
            {weekdays.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (!day) return <span key={`e${i}`} />;
              const disabled = day < min;
              const price = prices[day];
              const selected = day === value;
              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  aria-label={`${longDate(day, lang)}${price != null ? `, ${t.common.priceFrom} ${money(price, lang)}` : ""}`}
                  onClick={() => {
                    onChange(day);
                    setOpen(false);
                  }}
                  className={`flex min-h-[3rem] flex-col items-center justify-center rounded-lg px-0.5 text-sm tabular-nums transition ${
                    selected
                      ? "bg-brand-600 font-bold text-white"
                      : price != null
                        ? "bg-brand-50 font-semibold text-navy ring-1 ring-brand-200 hover:bg-brand-100"
                        : disabled
                          ? "text-slate-300"
                          : "text-ink-muted hover:bg-slate-100"
                  }`}
                >
                  {Number(day.slice(8))}
                  {price != null && !disabled ? (
                    <span className={`mt-0.5 text-center text-[9px] font-medium leading-[1.1] ${selected ? "text-white/90" : "text-brand-700"}`}>
                      {t.common.priceFrom} {money(price, lang)}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500" aria-live="polite">
            {!routeKnown ? s.calendarPickRoute : loading ? s.calendarLoading : s.calendarHint}
          </p>
        </div>
      ) : null}
    </div>
  );
}
