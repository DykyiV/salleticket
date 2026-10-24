"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/site/Icon";
import TripResultCard from "@/components/results/TripResultCard";
import { fmt, plural, useI18n } from "@/lib/i18n/client";
import { money } from "@/lib/i18n/format";
import {
  EMPTY_FILTERS,
  PERIOD_RANGE,
  SORTS,
  activeFilterCount,
  applyFilters,
  facets as computeFacets,
  sortTrips,
  writeFiltersToParams,
  type Facets,
  type Filters,
  type Period,
  type SortKey,
} from "@/lib/results/filter";
import type { Trip } from "@/lib/mockTrips";

type Props = {
  trips: Trip[];
  /** The searched cities (as typed) — the seat step searches them again. */
  from: string;
  to: string;
  pax: { adults: number; children: number; seniors: number };
  initialFilters: Filters;
  initialSort: SortKey;
  passengers: number;
  onlineDiscountPercent: number;
  date?: string;
  tripKind: string;
  returnDate?: string;
};

/** Results list with client-side filters and sorting, kept in the URL. */
export default function ResultsView(props: Props) {
  const { t, lang } = useI18n();
  const r = t.results;
  const [filters, setFilters] = useState<Filters>(props.initialFilters);
  const [sort, setSort] = useState<SortKey>(props.initialSort);
  const [sheetOpen, setSheetOpen] = useState(false);

  const facets = useMemo(() => computeFacets(props.trips), [props.trips]);
  const visible = useMemo(() => sortTrips(applyFilters(props.trips, filters), sort), [props.trips, filters, sort]);
  const active = activeFilterCount(filters);

  // Keep filters and sorting in the address bar (share / reload / back).
  useEffect(() => {
    const params = writeFiltersToParams(new URLSearchParams(window.location.search), filters, sort);
    const next = `${window.location.pathname}?${params.toString()}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(window.history.state, "", next);
    }
  }, [filters, sort]);

  const reset = () => setFilters(EMPTY_FILTERS);

  const seatHref = (trip: Trip) => {
    const q = new URLSearchParams({ carrierId: trip.carrierId, tripId: trip.id, from: props.from, to: props.to, tripKind: props.tripKind });
    if (props.date) q.set("date", props.date);
    if (trip.fromStopIndex != null) q.set("fi", String(trip.fromStopIndex));
    if (trip.toStopIndex != null) q.set("ti", String(trip.toStopIndex));
    if (props.returnDate) q.set("returnDate", props.returnDate);
    q.set("passengers", String(props.passengers));
    for (const [k, v] of Object.entries(props.pax)) if (v) q.set(k, String(v));
    return `/trip?${q.toString()}`;
  };

  const panel = <FilterPanel facets={facets} filters={filters} setFilters={setFilters} />;

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
      <aside className="hidden lg:block" aria-label={r.filters}>
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-200/70">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold text-navy">{r.filters}</h2>
            {active ? (
              <button type="button" onClick={reset} className="text-sm font-medium text-brand-700 hover:underline">
                {r.resetFilters}
              </button>
            ) : null}
          </div>
          {panel}
        </div>
      </aside>

      <div className="min-w-0">
        {/* Toolbar: count + sort (desktop), filters + sort (phone) */}
        <div className="sticky top-16 z-20 -mx-4 mb-4 flex items-center gap-2 border-b border-slate-200 bg-slate-50/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-navy lg:hidden"
          >
            <Icon name="menu" className="h-4 w-4" />
            {r.filters}
            {active ? (
              <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs text-white">{active}</span>
            ) : null}
          </button>
          <p className="hidden text-sm text-ink-soft lg:block" aria-live="polite">
            {visible.length === props.trips.length
              ? plural(lang, props.trips.length, r.found)
              : fmt(r.shown, { shown: visible.length, total: props.trips.length })}
          </p>
          <label className="ml-auto flex items-center gap-2 text-sm">
            <span className="hidden text-ink-soft sm:inline">{r.sortLabel}</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label={r.sortLabel}
              className="h-11 rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-sm font-semibold text-navy focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {r.sort[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="mb-3 text-sm text-ink-soft lg:hidden" aria-live="polite">
          {visible.length === props.trips.length
            ? plural(lang, props.trips.length, r.found)
            : fmt(r.shown, { shown: visible.length, total: props.trips.length })}
        </p>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-base font-semibold text-navy">{r.noMatch}</p>
            <button type="button" onClick={reset} className="btn-secondary mt-4 px-4 py-2 text-sm">
              {r.resetFilters}
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((trip) => (
              <li key={`${trip.carrierId}-${trip.id}-${trip.fromStopIndex ?? ""}`}>
                <TripResultCard
                  trip={trip}
                  passengers={props.passengers}
                  onlineDiscountPercent={props.onlineDiscountPercent}
                  seatHref={seatHref(trip)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {sheetOpen ? (
        <FilterSheet
          title={r.filters}
          onClose={() => setSheetOpen(false)}
          onReset={active ? reset : undefined}
          resetLabel={r.resetFilters}
          showLabel={plural(lang, visible.length, r.showTrips)}
          closeLabel={t.common.close}
        >
          {panel}
        </FilterSheet>
      ) : null}
    </div>
  );
}

function FilterPanel({
  facets,
  filters,
  setFilters,
}: {
  facets: Facets;
  filters: Filters;
  setFilters: (f: Filters | ((prev: Filters) => Filters)) => void;
}) {
  const { t, lang } = useI18n();
  const r = t.results;
  const amenities = t.buses.amenities as Record<string, string>;

  const toggle = <K extends keyof Filters>(key: K, value: string) =>
    setFilters((prev) => {
      const list = prev[key] as unknown as string[];
      const next = list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
      return { ...prev, [key]: next };
    });

  const periodGroup = (key: "dep" | "arr", title: string, options: Period[]) =>
    options.length > 1 ? (
      <Group title={title}>
        <div className="grid grid-cols-2 gap-2">
          {options.map((p) => {
            const on = filters[key].includes(p);
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(key, p)}
                className={`rounded-xl border px-2 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  on ? "border-brand-500 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-ink hover:border-brand-300"
                }`}
              >
                <span className="block font-semibold">{r.periods[p]}</span>
                <span className="block text-xs text-ink-soft">{PERIOD_RANGE[p]}</span>
              </button>
            );
          })}
        </div>
      </Group>
    ) : null;

  return (
    <div className="divide-y divide-slate-100">
      {periodGroup("dep", r.departureTime, facets.dep)}
      {periodGroup("arr", r.arrivalTime, facets.arr)}

      {facets.price && facets.price.max > facets.price.min ? (
        <Group title={r.price}>
          <Range
            min={facets.price.min}
            max={facets.price.max}
            value={filters.maxPrice ?? facets.price.max}
            label={fmt(r.upTo, { v: money(filters.maxPrice ?? facets.price.max, lang) })}
            onChange={(v) => setFilters((prev) => ({ ...prev, maxPrice: v >= facets.price!.max ? null : v }))}
          />
        </Group>
      ) : null}

      {facets.hours && facets.hours.max > facets.hours.min ? (
        <Group title={r.duration}>
          <Range
            min={facets.hours.min}
            max={facets.hours.max}
            value={filters.maxHours ?? facets.hours.max}
            label={fmt(r.upTo, { v: fmt(r.hours, { h: filters.maxHours ?? facets.hours.max }) })}
            onChange={(v) => setFilters((prev) => ({ ...prev, maxHours: v >= facets.hours!.max ? null : v }))}
          />
        </Group>
      ) : null}

      {facets.stops.length > 1 ? (
        <Group title={r.transfers}>
          {facets.stops.map((s) => (
            <Check key={s} label={s === "direct" ? r.direct : r.withTransfer} checked={filters.stops.includes(s)} onChange={() => toggle("stops", s)} />
          ))}
        </Group>
      ) : null}

      {facets.categories.length > 1 ? (
        <Group title={r.busType}>
          {facets.categories.map((c) => (
            <Check
              key={c}
              label={(r.categories as Record<string, string>)[c] ?? c}
              checked={filters.categories.includes(c)}
              onChange={() => toggle("categories", c)}
            />
          ))}
        </Group>
      ) : null}

      {facets.carriers.length > 1 ? (
        <Group title={r.carrier}>
          {facets.carriers.map((c) => (
            <Check key={c} label={c} checked={filters.carriers.includes(c)} onChange={() => toggle("carriers", c)} />
          ))}
        </Group>
      ) : null}

      {facets.features.length ? (
        <Group title={r.amenities}>
          {facets.features
            .filter((f) => f === "wifi" || f === "sockets" || f === "wc" || f === "ac" || f === "water")
            .map((f) => (
              <Check key={f} label={amenities[f] ?? f} checked={filters.features.includes(f)} onChange={() => toggle("features", f)} />
            ))}
        </Group>
      ) : null}

      {facets.luggage.length > 1 ? (
        <Group title={r.luggage}>
          {facets.luggage.slice(1).map((n) => (
            <Check
              key={n}
              label={plural(lang, n, r.luggageAtLeast)}
              checked={filters.minLuggage === n}
              onChange={() => setFilters((prev) => ({ ...prev, minLuggage: prev.minLuggage === n ? null : n }))}
            />
          ))}
        </Group>
      ) : null}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="py-4 first:pt-2">
      <legend className="mb-2 text-sm font-semibold text-navy">{title}</legend>
      <div className="space-y-1">{children}</div>
    </fieldset>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex min-h-[2.5rem] cursor-pointer items-center gap-3 rounded-lg px-1 text-sm text-ink hover:bg-slate-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      {label}
    </label>
  );
}

function Range({
  min,
  max,
  value,
  label,
  onChange,
}: {
  min: number;
  max: number;
  value: number;
  label: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink">{label}</p>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="w-full accent-brand-600"
      />
    </div>
  );
}

function FilterSheet({
  title,
  children,
  onClose,
  onReset,
  resetLabel,
  showLabel,
  closeLabel,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onReset?: () => void;
  resetLabel: string;
  showLabel: string;
  closeLabel: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-white lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-4">
        <h2 className="text-lg font-semibold text-navy">{title}</h2>
        <div className="flex items-center gap-1">
          {onReset ? (
            <button type="button" onClick={onReset} className="rounded-lg px-3 py-2 text-sm font-medium text-brand-700">
              {resetLabel}
            </button>
          ) : null}
          <button
            ref={closeRef}
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-navy hover:bg-slate-100"
          >
            <Icon name="close" className="h-6 w-6" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4">{children}</div>
      <div className="shrink-0 border-t border-slate-100 p-4">
        <button type="button" onClick={onClose} className="btn-primary w-full">
          {showLabel}
        </button>
      </div>
    </div>,
    document.body
  );
}
