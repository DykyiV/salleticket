"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { inputClass } from "@/components/admin/Field";
import { countryNameByCode, flagEmoji } from "@/lib/routes/countries";
import type { BoardDeparture, SeatCounts } from "@/lib/departures/board";
import { SEAT_COLORS, SeatLegend } from "@/components/departures/seatColors";

const WEEKDAYS = ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "Пʼятниця", "Субота"];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const ddmmyyyy = (iso: string) => iso.split("-").reverse().join(".");
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

type Sort = "time" | "route" | "bus" | "ours";

/** Seat counts already loaded on this page (kept while filters change). */
const countsCache = new Map<string, SeatCounts | null>();

function SeatBar({ url }: { url: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [counts, setCounts] = useState<SeatCounts | null | undefined>(url ? countsCache.get(url) : null);

  useEffect(() => {
    const el = ref.current;
    if (!url || !el || countsCache.has(url)) return;
    let cancelled = false;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      fetch(url)
        .then((r) => (r.ok ? r.json() : { counts: null }))
        .catch(() => ({ counts: null }))
        .then((d: { counts: SeatCounts | null }) => {
          countsCache.set(url, d.counts);
          if (!cancelled) setCounts(d.counts);
        });
    });
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [url]);

  if (counts === undefined) return <div ref={ref} className="h-6 w-full animate-pulse rounded bg-slate-100" />;
  if (!counts || !counts.total) return <div ref={ref} className="text-xs text-slate-400">немає даних</div>;
  const parts = (["closed", "reserved", "purchased", "free"] as const).filter((k) => counts[k] > 0);
  return (
    <div ref={ref} className="flex h-6 w-full overflow-hidden rounded text-[11px] font-semibold leading-6">
      {parts.map((k) => (
        <span
          key={k}
          className={`${SEAT_COLORS[k].bar} min-w-[1.25rem] text-center`}
          style={{ width: `${(counts[k] / counts.total) * 100}%` }}
          title={`${SEAT_COLORS[k].label}: ${counts[k]}`}
        >
          {counts[k]}
        </span>
      ))}
    </div>
  );
}

export default function DepartureBoard({
  departures,
  from,
  to,
  today,
  initialRoute,
}: {
  departures: BoardDeparture[];
  from: string;
  to: string;
  today: string;
  /** Route filter to start with ("gt-145", from a route's page). */
  initialRoute?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [route, setRoute] = useState(initialRoute ?? "");
  const [direction, setDirection] = useState("");
  const [day, setDay] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("time");
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);

  const presets = [
    { key: "today", label: "Сьогодні", from: today, to: today },
    { key: "week", label: `Тиждень вперед (${ddmmyyyy(today)} – ${ddmmyyyy(addDays(today, 7))})`, from: today, to: addDays(today, 7) },
    { key: "month", label: `Місяць вперед (${ddmmyyyy(today)} – ${ddmmyyyy(addDays(today, 30))})`, from: today, to: addDays(today, 30) },
  ];
  const preset = presets.find((p) => p.from === from && p.to === to)?.key ?? "custom";
  const [period, setPeriod] = useState(preset);

  const go = (f: string, t: string) =>
    startTransition(() => router.push(`/cabinet/departures?from=${f}&to=${t}`));

  const routes = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const d of departures) byKey.set(d.routeKey, d.routeName);
    return [...byKey.entries()].sort((a, b) => a[1].localeCompare(b[1], "uk"));
  }, [departures]);

  const days = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = departures.filter(
      (d) =>
        (!route || d.routeKey === route) &&
        (!direction || d.direction === direction) &&
        (!day || weekday(d.date) === Number(day)) &&
        (!q ||
          [d.route, d.routeName, d.from, d.to, d.carrier, d.bus.number, d.bus.mark].some((v) => v.toLowerCase().includes(q))),
    );
    const order = (a: BoardDeparture, b: BoardDeparture) =>
      sort === "route"
        ? a.route.localeCompare(b.route, "uk") || a.time.localeCompare(b.time)
        : sort === "bus"
          ? `${a.bus.mark} ${a.bus.number}`.localeCompare(`${b.bus.mark} ${b.bus.number}`) || a.time.localeCompare(b.time)
          : sort === "ours"
            ? b.ours - a.ours || a.time.localeCompare(b.time)
            : a.time.localeCompare(b.time);
    const groups = new Map<string, BoardDeparture[]>();
    for (const d of shown) groups.set(d.date, [...(groups.get(d.date) ?? []), d]);
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      // Within a day the departures of one country stay together (as on GT's board).
      .map(([date, items]) => ({
        date,
        items: items.sort((a, b) => (a.countryCode || "ZZ").localeCompare(b.countryCode || "ZZ") || order(a, b)),
      }));
  }, [departures, route, direction, day, query, sort]);

  const shown = days.flatMap((g) => g.items);
  const count = shown.length;
  const chosen = shown.filter((d) => selected.has(d.id));
  const allChosen = count > 0 && chosen.length === count;
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allChosen ? new Set() : new Set(shown.map((d) => d.id)));

  // Transfers list: departures of one day and one country.
  const transferBlocked = !chosen.length
    ? "Позначте виїзди галочками."
    : new Set(chosen.map((d) => d.date)).size > 1 || new Set(chosen.map((d) => d.countryCode)).size > 1
      ? "Оберіть виїзди одного дня й однієї країни (напр. вівторок, усі з Німеччини)."
      : null;

  return (
    <div className="space-y-4">
      <section className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.6fr]">
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-slate-600">Маршрут</span>
          <select className={inputClass} value={route} onChange={(e) => setRoute(e.target.value)}>
            <option value="">Всі маршрути</option>
            {routes.map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-slate-600">Напрямок</span>
          <select className={inputClass} value={direction} onChange={(e) => setDirection(e.target.value)}>
            <option value="">Всі напрямки</option>
            <option value="to">Туди</option>
            <option value="back">Назад</option>
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-slate-600">День тижня</span>
          <select className={inputClass} value={day} onChange={(e) => setDay(e.target.value)}>
            <option value="">Всі дні</option>
            {WEEKDAY_ORDER.map((d) => (
              <option key={d} value={d}>
                {WEEKDAYS[d]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-slate-600">Дата</span>
          <select
            className={inputClass}
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              const p = presets.find((x) => x.key === e.target.value);
              if (p) go(p.from, p.to);
            }}
          >
            {presets.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
            <option value="custom">Свій період…</option>
          </select>
        </label>
        {period === "custom" ? (
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-slate-600">З</span>
              <input type="date" className={inputClass} value={customFrom} min={today} onChange={(e) => setCustomFrom(e.target.value)} />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-slate-600">По</span>
              <input type="date" className={inputClass} value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} />
            </label>
            <button
              type="button"
              className="h-9 rounded bg-slate-900 px-3 text-sm font-medium text-white disabled:opacity-60"
              disabled={!customFrom || !customTo || customTo < customFrom}
              onClick={() => go(customFrom, customTo)}
            >
              Показати
            </button>
          </div>
        ) : null}
        <label className="block text-xs sm:col-span-2 lg:col-span-3">
          <span className="mb-1 block font-medium text-slate-600">Пошук</span>
          <input
            className={inputClass}
            placeholder="Пошук… (по маршруту, місту та автобусу)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-slate-600">Сортувати в межах дня</span>
          <select className={inputClass} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="time">За часом відправлення</option>
            <option value="route">За маршрутом</option>
            <option value="bus">За автобусом</option>
            <option value="ours">Спершу з нашими пасажирами</option>
          </select>
        </label>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <SeatLegend />
        <p className="text-xs text-slate-500">{pending ? "Завантаження…" : `Виїздів: ${count}`}</p>
      </div>

      {days.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-sm text-slate-500 ring-1 ring-slate-200">
          {departures.length ? "Нічого не знайдено за цими фільтрами." : "Немає виїздів у цьому періоді."}
        </p>
      ) : (
        <div className={`rounded-2xl bg-white ring-1 ring-slate-200 ${pending ? "opacity-60" : ""}`}>
          <div className="relative flex items-center gap-3 border-b border-slate-200 px-4 py-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={allChosen}
              ref={(el) => {
                if (el) el.indeterminate = chosen.length > 0 && !allChosen;
              }}
              onChange={toggleAll}
              aria-label="Позначити всі показані виїзди"
            />
            <button
              type="button"
              className="rounded px-2 py-1 text-lg leading-none text-slate-600 hover:bg-slate-100"
              aria-label="Дії з позначеними виїздами"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              ⋮
            </button>
            <span className="text-xs text-slate-500">{chosen.length ? `Позначено: ${chosen.length}` : "Позначте виїзди, щоб виконати дію"}</span>
            {menuOpen ? (
              <>
                <button type="button" aria-label="Закрити" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuOpen(false)} />
                <div className="absolute left-4 top-full z-20 mt-1 w-80 rounded-xl bg-white p-2 text-sm shadow-lg ring-1 ring-slate-200">
                  <button
                    type="button"
                    disabled={!!transferBlocked}
                    className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => {
                      setMenuOpen(false);
                      router.push(`/cabinet/departures/transfers?date=${chosen[0].date}&ids=${chosen.map((d) => d.id).join(",")}`);
                    }}
                  >
                    <span className="block font-medium text-slate-900">Пасажири по містах (для пересадок)</span>
                    <span className="block text-xs text-slate-500">
                      {transferBlocked ?? "Хто скільки сідає й виходить у кожному місті з кожного автобуса."}
                    </span>
                  </button>
                  <p className="mt-1 border-t border-slate-100 px-3 pt-2 text-xs text-slate-500">
                    Показати чи приховати місто, місця, змінити телефон — для наших рейсів:{" "}
                    <Link href="/cabinet/departures?tab=own" className="text-brand-700 hover:underline">
                      «Наші рейси»
                    </Link>
                    . Рейси Grandes Tour змінюються лише в системі GT.
                  </p>
                </div>
              </>
            ) : null}
          </div>
          <div className="hidden grid-cols-[minmax(0,2.2fr)_4.5rem_3.5rem_minmax(0,2fr)_minmax(0,1.5fr)] gap-3 border-b border-slate-200 px-4 py-2 text-xs font-medium text-slate-500 md:grid">
            <span>Маршрут</span>
            <span>Час</span>
            <span>Місця</span>
            <span>Заповненість</span>
            <span>Автобус</span>
          </div>
          {days.map((g) => (
            <section key={g.date}>
              <header className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900">
                {ddmmyyyy(g.date)}, {WEEKDAYS[weekday(g.date)]}
                {g.date === today ? " (Сьогодні)" : g.date === addDays(today, 1) ? " (Завтра)" : ""}
              </header>
              <ul className="divide-y divide-slate-100">
                {g.items.map((d, i) => [
                  i === 0 || g.items[i - 1].countryCode !== d.countryCode ? (
                    <li key={`${d.countryCode}-head`} className="bg-slate-50/60 px-4 py-1.5 text-xs font-medium text-slate-500">
                      {d.countryCode ? `${flagEmoji(d.countryCode)} Звідки: ${countryNameByCode(d.countryCode)}` : "Країна невідома"} ·{" "}
                      {g.items.filter((x) => x.countryCode === d.countryCode).length}
                    </li>
                  ) : null,
                  <li
                    key={d.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 px-4 py-2.5 text-sm md:grid-cols-[minmax(0,2.2fr)_4.5rem_3.5rem_minmax(0,2fr)_minmax(0,1.5fr)]"
                  >
                    <div className="min-w-0">
                      <input
                        type="checkbox"
                        className="mr-2 h-4 w-4 align-middle"
                        checked={selected.has(d.id)}
                        onChange={() => toggle(d.id)}
                        aria-label={`Позначити ${d.route} ${d.time}`}
                      />
                      <Link href={`/cabinet/departures/${d.id}?date=${d.date}`} className="font-medium text-brand-700 hover:underline">
                        <span className="mr-1.5" aria-hidden="true">
                          {d.countryCode ? flagEmoji(d.countryCode) : "🚌"}
                        </span>
                        {d.route}
                      </Link>
                      <span className="ml-2 whitespace-nowrap rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">
                        {d.carrier}
                      </span>
                      {d.ours ? (
                        <span className="ml-1 whitespace-nowrap rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                          наших: {d.ours}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-slate-700" title={`Прибуття ${ddmmyyyy(d.arrivalDate)} ${d.arrivalTime}`}>
                      {d.time}
                    </span>
                    <span className="hidden text-slate-700 md:inline">{d.bus.seats || "—"}</span>
                    <div className="col-span-2 md:col-span-1">
                      <SeatBar url={d.seatsUrl} />
                    </div>
                    <span className="col-span-2 flex min-w-0 items-center gap-2 text-slate-700 md:col-span-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/bus.png" alt="" className="h-8 w-8 shrink-0" />
                      <span className="truncate">
                        {d.bus.mark ? `${d.bus.mark} ` : ""}
                        {d.bus.number ? `[${d.bus.number}]` : "—"}
                      </span>
                    </span>
                  </li>,
                ])}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
