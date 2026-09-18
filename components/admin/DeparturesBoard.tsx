"use client";

import { useMemo, useState } from "react";
import Field, { btnGhost, btnPrimary, inputClass } from "@/components/admin/Field";
import CountryFlags from "@/components/cabinet/CountryFlags";
import DateRangeCalendar from "@/components/cabinet/DateRangeCalendar";
import { mapsUrl } from "@/lib/routes/boarding";
import { groupDeparturesByDayAndDirection } from "@/lib/routes/groupDepartures";
import {
  DEPARTURE_PAGE_SIZE,
  routeMatchesCountry,
  type DepartureCountryOption,
  type DepartureRouteOption,
} from "@/lib/routes/listDepartures";
import type { DepartureDTO } from "@/lib/routes/serialize";
import type { BulkAction } from "@/lib/routes/bulk";

export type Capabilities = {
  canEdit: boolean;
  canHideStops: boolean;
  canHideSeats: boolean;
  canBulk: boolean;
  canManageTemplates: boolean;
};

type Props = {
  mode: "admin" | "agent";
  initialFrom: string;
  initialTo: string;
  initialTemplateId?: string;
  initialCountryId?: string;
  initialPage?: number;
  initialTotal?: number;
  initialTotalPages?: number;
  initialDepartures?: DepartureDTO[];
  countries: DepartureCountryOption[];
  routes: DepartureRouteOption[];
  capabilities: Capabilities;
};

const BULK_ACTIONS: {
  value: BulkAction;
  label: string;
  key: "canEdit" | "canHideStops" | "canHideSeats";
}[] = [
    { value: "hideStops", label: "Приховати міста", key: "canHideStops" },
    { value: "showStops", label: "Показати міста", key: "canHideStops" },
    { value: "setSaleEnabled", label: "Продаж місць у місті", key: "canHideSeats" },
    { value: "setStopTime", label: "Змінити години", key: "canEdit" },
  ];

function ukCount(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} виїзд`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${n} виїзди`;
  }
  return `${n} виїздів`;
}

export default function DeparturesBoard({
  mode,
  initialFrom,
  initialTo,
  initialTemplateId,
  initialCountryId,
  initialPage = 1,
  initialTotal = 0,
  initialTotalPages = 1,
  initialDepartures = [],
  countries,
  routes,
  capabilities,
}: Props) {
  const listUrl =
    mode === "admin" ? "/api/admin/departures" : "/api/agent/departures";
  const bulkUrl =
    mode === "admin"
      ? "/api/admin/departures/bulk"
      : "/api/agent/departures/bulk";

  const allowedActions = BULK_ACTIONS.filter((item) => capabilities[item.key]);
  const canBulk = capabilities.canBulk && allowedActions.length > 0;

  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [countryId, setCountryId] = useState(initialCountryId ?? "");
  const [templateId, setTemplateId] = useState(initialTemplateId ?? "");
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(initialTotal);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [departures, setDepartures] = useState<DepartureDTO[]>(initialDepartures);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<BulkAction>(
    allowedActions[0]?.value ?? "hideStops"
  );
  const [city, setCity] = useState("");
  const [sortFrom, setSortFrom] = useState("1");
  const [sortTo, setSortTo] = useState("4");
  const [outboundTime, setOutboundTime] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [saleEnabled, setSaleEnabled] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const patchDepartureUrl = (id: string) =>
    mode === "admin"
      ? `/api/admin/departures/${id}`
      : `/api/agent/departures/${id}`;

  const patchDeparture = async (row: DepartureDTO, body: Record<string, unknown>) => {
    if (!capabilities.canEdit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(patchDepartureUrl(row.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Не вдалося оновити виїзд");
      setDepartures((prev) =>
        prev.map((item) => (item.id === row.id ? { ...item, ...data } : item))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  const toggleAssignedSeats = (row: DepartureDTO) =>
    patchDeparture(row, { hasAssignedSeats: !row.hasAssignedSeats });

  const toggleSegmentSales = (row: DepartureDTO) =>
    patchDeparture(row, { allowSegmentSales: !row.allowSegmentSales });

  const visibleRoutes = useMemo(
    () => routes.filter((route) => routeMatchesCountry(route, countryId)),
    [routes, countryId]
  );

  const load = async (
    nextPage = 1,
    query?: {
      from?: string;
      to?: string;
      countryId?: string;
      templateId?: string;
    }
  ) => {
    const nextFrom = query?.from ?? from;
    const nextTo = query?.to ?? to;
    const nextCountry = query?.countryId ?? countryId;
    const nextTemplate = query?.templateId ?? templateId;
    setError(null);
    const params = new URLSearchParams({
      from: nextFrom,
      to: nextTo,
      page: String(nextPage),
      pageSize: String(DEPARTURE_PAGE_SIZE),
    });
    if (nextCountry) params.set("countryId", nextCountry);
    if (nextTemplate) params.set("templateId", nextTemplate);
    const res = await fetch(`${listUrl}?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Не вдалося завантажити виїзди");
    setDepartures(data.departures ?? []);
    setTotal(data.total ?? 0);
    setTotalPages(data.totalPages ?? 1);
    setPage(data.page ?? nextPage);
    setSelected(new Set());
  };

  const onCountry = (id: string) => {
    const keepTemplate = routes.some(
      (route) => route.id === templateId && routeMatchesCountry(route, id)
    )
      ? templateId
      : "";
    setCountryId(id);
    setTemplateId(keepTemplate);
    load(1, { countryId: id, templateId: keepTemplate }).catch((err) =>
      setError(err instanceof Error ? err.message : "Помилка")
    );
  };

  const onRoute = (id: string) => {
    setTemplateId(id);
    load(1, { templateId: id }).catch((err) =>
      setError(err instanceof Error ? err.message : "Помилка")
    );
  };

  const onDates = (nextFrom: string, nextTo: string) => {
    setFrom(nextFrom);
    setTo(nextTo);
    load(1, { from: nextFrom, to: nextTo }).catch((err) =>
      setError(err instanceof Error ? err.message : "Помилка")
    );
  };

  const days = useMemo(
    () => groupDeparturesByDayAndDirection(departures),
    [departures]
  );

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (items: DepartureDTO[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = items.every((i) => next.has(i.id));
      for (const item of items) {
        if (allOn) next.delete(item.id);
        else next.add(item.id);
      }
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const apply = async () => {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        departureIds: [...selected],
        action,
        city: city.trim() || null,
        sortFrom: sortFrom ? Number(sortFrom) : null,
        sortTo: sortTo ? Number(sortTo) : null,
      };
      if (action === "setStopTime") {
        body.outboundTime = outboundTime || null;
        body.returnTime = returnTime || null;
      }
      if (action === "setSaleEnabled") {
        body.saleEnabled = saleEnabled;
      }
      const res = await fetch(bulkUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Не вдалося оновити");
      setMessage(
        `Оновлено зупинок: ${data.updatedStops} у ${data.updatedDepartures} виїздах.`
      );
      await load(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  const actionAllowed =
    canBulk &&
    selected.size > 0 &&
    allowedActions.some((item) => item.value === action);

  const goPage = (next: number) => {
    load(next).catch((err) =>
      setError(err instanceof Error ? err.message : "Помилка")
    );
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DateRangeCalendar from={from} to={to} onChange={onDates} />
          <Field label="Країна">
            <select
              className={inputClass}
              value={countryId}
              onChange={(e) => onCountry(e.target.value)}
            >
              <option value="">Усі країни</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Маршрут">
            <select
              className={inputClass}
              value={templateId}
              onChange={(e) => onRoute(e.target.value)}
            >
              <option value="">Усі маршрути</option>
              {visibleRoutes.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {canBulk ? (
        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">
            Масове редагування ({selected.size} вибрано)
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Відмітьте однакові маршрути й змініть видимість міст, продаж місць або
            години. Доступно адміну та агенту з відповідним правом.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Дія">
              <select
                className={inputClass}
                value={action}
                onChange={(e) => setAction(e.target.value as BulkAction)}
              >
                {allowedActions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Місто (або залиште порожнім)">
              <input
                className={inputClass}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Марбелья"
              />
            </Field>
            <Field label="№ з">
              <input
                type="number"
                min={1}
                className={inputClass}
                value={sortFrom}
                onChange={(e) => setSortFrom(e.target.value)}
              />
            </Field>
            <Field label="№ по">
              <input
                type="number"
                min={1}
                className={inputClass}
                value={sortTo}
                onChange={(e) => setSortTo(e.target.value)}
              />
            </Field>
            {action === "setStopTime" ? (
              <>
                <Field label="Новий час туди">
                  <input
                    type="time"
                    className={inputClass}
                    value={outboundTime}
                    onChange={(e) => setOutboundTime(e.target.value)}
                  />
                </Field>
                <Field label="Новий час назад">
                  <input
                    type="time"
                    className={inputClass}
                    value={returnTime}
                    onChange={(e) => setReturnTime(e.target.value)}
                  />
                </Field>
              </>
            ) : null}
            {action === "setSaleEnabled" ? (
              <label className="flex items-end gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={saleEnabled}
                  onChange={(e) => setSaleEnabled(e.target.checked)}
                />
                Дозволити продаж
              </label>
            ) : null}
          </div>
          <div className="mt-3">
            <button
              type="button"
              className={btnPrimary}
              disabled={busy || !actionAllowed}
              onClick={apply}
            >
              Застосувати до вибраних
            </button>
            {!actionAllowed && selected.size > 0 ? (
              <span className="ml-2 text-xs text-amber-700">
                Немає права на цю дію.
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <p className="text-xs text-slate-500">
        {total === 0
          ? "Немає виїздів у цьому періоді."
          : `Показано ${departures.length} з ${total} виїздів · сторінка ${page} з ${totalPages}`}
      </p>

      {days.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-sm text-slate-500 ring-1 ring-slate-200">
          Немає виїздів у цьому періоді. Створіть їх зі сторінки шаблону маршруту.
        </p>
      ) : (
        days.map((day) => (
          <section
            key={day.date}
            className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200"
          >
            <header className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
              {day.label}
            </header>
            <div className="divide-y divide-slate-100">
              {day.directions.map((dir) => {
                const allOn = dir.items.every((i) => selected.has(i.id));
                return (
                  <div key={`${day.date}-${dir.key}`}>
                    <div className="flex flex-wrap items-center gap-3 bg-slate-50/70 px-4 py-2">
                      {canBulk ? (
                        <input
                          type="checkbox"
                          checked={allOn}
                          onChange={() => toggleGroup(dir.items)}
                          aria-label={`Вибрати ${dir.originShort} — ${dir.destinationShort}`}
                        />
                      ) : null}
                      <CountryFlags
                        originCode={dir.originCode}
                        destinationCode={dir.destinationCode}
                        originShort={dir.originShort}
                        destinationShort={dir.destinationShort}
                        originName={dir.originName}
                        destinationName={dir.destinationName}
                      />
                      <span className="text-xs text-slate-400">
                        {ukCount(dir.items.length)}
                      </span>
                    </div>
                    {dir.items.map((row) => {
                      const first = row.stops[0];
                      return (
                        <div key={row.id} className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-3">
                            {canBulk ? (
                              <input
                                type="checkbox"
                                checked={selected.has(row.id)}
                                onChange={() => toggleOne(row.id)}
                              />
                            ) : null}
                            <CountryFlags
                              size="sm"
                              originCode={dir.originCode}
                              destinationCode={dir.destinationCode}
                              originShort={dir.originShort}
                              destinationShort={dir.destinationShort}
                              originName={dir.originName}
                              destinationName={dir.destinationName}
                            />
                            <button
                              type="button"
                              className="text-left text-sm font-medium text-slate-900"
                              onClick={() => toggleExpand(row.id)}
                            >
                              {row.originCity} → {row.destinationCity}
                            </button>
                            <span className="text-xs text-slate-500">
                              {first
                                ? `${first.outboundTime} · д.${first.outboundDay}`
                                : row.templateName}
                            </span>
                            <span className="text-xs text-slate-400">
                              {row.defaultBus ?? "автобус не вказано"}
                            </span>
                            {capabilities.canEdit ? (
                              <>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => toggleAssignedSeats(row)}
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                                    row.hasAssignedSeats
                                      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                                      : "bg-slate-100 text-slate-600 ring-slate-200"
                                  }`}
                                >
                                  {row.hasAssignedSeats ? "місця" : "без місць"}
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => toggleSegmentSales(row)}
                                  title="Продаж місць по ділянках маршруту"
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                                    row.allowSegmentSales
                                      ? "bg-indigo-50 text-indigo-800 ring-indigo-200"
                                      : "bg-slate-100 text-slate-600 ring-slate-200"
                                  }`}
                                >
                                  {row.allowSegmentSales ? "сегменти" : "без сегментів"}
                                </button>
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-500">
                                {row.hasAssignedSeats ? "місця" : "без місць"}
                              </span>
                            )}
                            <button
                              type="button"
                              className="ml-auto text-xs text-brand-700"
                              onClick={() => toggleExpand(row.id)}
                            >
                              {expanded.has(row.id) ? "згорнути" : "міста"}
                            </button>
                          </div>
                          {expanded.has(row.id) ? (
                            <table className="mt-3 w-full text-xs">
                              <thead className="text-left text-slate-500">
                                <tr>
                                  <th className="py-1">№</th>
                                  <th>Місто</th>
                                  <th>Туди</th>
                                  <th>Назад</th>
                                  <th>Посадка</th>
                                  <th>Видиме</th>
                                  <th>Продаж</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.stops.map((stop) => {
                                  const url = mapsUrl(stop);
                                  return (
                                    <tr
                                      key={stop.id}
                                      className="border-t border-slate-100"
                                    >
                                      <td className="py-1 pr-2">
                                        {stop.sortOrder}
                                      </td>
                                      <td>{stop.city}</td>
                                      <td>
                                        д.{stop.outboundDay} {stop.outboundTime}
                                      </td>
                                      <td>
                                        д.{stop.returnDay} {stop.returnTime}
                                      </td>
                                      <td>
                                        {stop.addressLabel ||
                                          stop.boardingAddress ||
                                          "—"}
                                        {url ? (
                                          <>
                                            {" "}
                                            <a
                                              href={url}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="text-brand-700"
                                            >
                                              карта
                                            </a>
                                          </>
                                        ) : null}
                                      </td>
                                      <td>{stop.isVisible ? "так" : "ні"}</td>
                                      <td>{stop.saleEnabled ? "так" : "ні"}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={btnGhost}
            disabled={page <= 1}
            onClick={() => goPage(page - 1)}
          >
            Назад
          </button>
          <span className="text-sm text-slate-600">
            Сторінка {page} з {totalPages}
          </span>
          <button
            type="button"
            className={btnGhost}
            disabled={page >= totalPages}
            onClick={() => goPage(page + 1)}
          >
            Далі
          </button>
        </div>
      ) : null}
    </div>
  );
}
