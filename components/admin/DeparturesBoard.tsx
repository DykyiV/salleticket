"use client";

import { useEffect, useMemo, useState } from "react";
import Field, { btnGhost, btnPrimary, inputClass } from "@/components/admin/Field";
import { formatUkDate } from "@/lib/routes/dates";
import { weekdayShort } from "@/lib/routes/weekdays";
import { mapsUrl } from "@/lib/routes/boarding";
import type { DepartureDTO } from "@/lib/routes/serialize";
import type { BulkAction } from "@/lib/routes/bulk";

export type Capabilities = {
  canEdit: boolean;
  canHideStops: boolean;
  canHideSeats: boolean;
  canManageTemplates: boolean;
};

type Props = {
  mode: "admin" | "agent";
  initialFrom: string;
  initialTo: string;
  initialTemplateId?: string;
  initialDepartures?: DepartureDTO[];
  capabilities: Capabilities;
};

type Group = {
  templateId: string;
  templateName: string;
  countryName: string;
  items: DepartureDTO[];
};

export default function DeparturesBoard({
  mode,
  initialFrom,
  initialTo,
  initialTemplateId,
  initialDepartures = [],
  capabilities,
}: Props) {
  const listUrl =
    mode === "admin" ? "/api/admin/departures" : "/api/agent/departures";
  const bulkUrl =
    mode === "admin"
      ? "/api/admin/departures/bulk"
      : "/api/agent/departures/bulk";

  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [templateId, setTemplateId] = useState(initialTemplateId ?? "");
  const [departures, setDepartures] = useState<DepartureDTO[]>(initialDepartures);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<BulkAction>("hideStops");
  const [city, setCity] = useState("");
  const [sortFrom, setSortFrom] = useState("1");
  const [sortTo, setSortTo] = useState("4");
  const [outboundTime, setOutboundTime] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [saleEnabled, setSaleEnabled] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    setError(null);
    const params = new URLSearchParams({ from, to });
    if (templateId) params.set("templateId", templateId);
    const res = await fetch(`${listUrl}?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Не вдалося завантажити виїзди");
    setDepartures(data.departures ?? []);
    setSelected(new Set());
  };

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof Error ? err.message : "Помилка завантаження")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const row of departures) {
      const key = row.templateId;
      const bucket = map.get(key) ?? {
        templateId: row.templateId,
        templateName: row.templateName,
        countryName: row.countryName,
        items: [],
      };
      bucket.items.push(row);
      map.set(key, bucket);
    }
    return [...map.values()];
  }, [departures]);

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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  const actionAllowed =
    (action === "hideStops" || action === "showStops"
      ? capabilities.canHideStops
      : action === "setSaleEnabled"
        ? capabilities.canHideSeats
        : capabilities.canEdit) && selected.size > 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:grid-cols-4">
        <Field label="Від">
          <input
            type="date"
            className={inputClass}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="До">
          <input
            type="date"
            className={inputClass}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <div className="flex items-end">
          <button
            type="button"
            className={btnGhost}
            onClick={() =>
              load().catch((err) =>
                setError(err instanceof Error ? err.message : "Помилка")
              )
            }
          >
            Показати
          </button>
        </div>
      </div>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">
          Масове редагування ({selected.size} вибрано)
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Відмітьте однакові маршрути й змініть видимість міст, продаж місць або
          години. Наприклад: сховати міста 1–4 або показати Марбелью в четвергових
          виїздах.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Дія">
            <select
              className={inputClass}
              value={action}
              onChange={(e) => setAction(e.target.value as BulkAction)}
            >
              <option value="hideStops">Приховати міста</option>
              <option value="showStops">Показати міста</option>
              <option value="setSaleEnabled">Продаж місць у місті</option>
              <option value="setStopTime">Змінити години</option>
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

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      {groups.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-sm text-slate-500 ring-1 ring-slate-200">
          Немає виїздів у цьому періоді. Створіть їх зі сторінки шаблону маршруту.
        </p>
      ) : (
        groups.map((group) => {
          const allOn = group.items.every((i) => selected.has(i.id));
          return (
            <section
              key={group.templateId}
              className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200"
            >
              <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <input
                    type="checkbox"
                    checked={allOn}
                    onChange={() => toggleGroup(group.items)}
                  />
                  {group.templateName}
                </label>
                <span className="text-xs text-slate-500">{group.countryName}</span>
                <span className="text-xs text-slate-400">
                  {group.items.length} виїздів
                </span>
              </header>
              <div className="divide-y divide-slate-100">
                {group.items.map((row) => (
                  <div key={row.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleOne(row.id)}
                      />
                      <button
                        type="button"
                        className="text-left text-sm font-medium text-slate-900"
                        onClick={() => toggleExpand(row.id)}
                      >
                        {formatUkDate(row.date)} · {weekdayShort(row.weekday)}
                      </button>
                      <span className="text-xs text-slate-500">
                        {row.originCity} → {row.destinationCity}
                      </span>
                      <span className="text-xs text-slate-400">
                        {row.defaultBus ?? "автобус не вказано"} ·{" "}
                        {row.busPhone ?? "немає тел."}
                      </span>
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
                              <tr key={stop.id} className="border-t border-slate-100">
                                <td className="py-1 pr-2">{stop.sortOrder}</td>
                                <td>{stop.city}</td>
                                <td>
                                  д.{stop.outboundDay} {stop.outboundTime}
                                </td>
                                <td>
                                  д.{stop.returnDay} {stop.returnTime}
                                </td>
                                <td>
                                  {stop.addressLabel || stop.boardingAddress || "—"}
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
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
