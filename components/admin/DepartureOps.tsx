"use client";

import { useEffect, useState } from "react";
import { btnGhost, btnPrimary, inputClass } from "@/components/admin/Field";

type Zone = { id: string; name: string; fromSeat: number; toSeat: number; groupLabel: string | null };
type Assignment = {
  id: string;
  busId: string;
  busPlate: string;
  busModel: string | null;
  capacity: number;
  sold: number;
  free: number;
  isDirect: boolean;
  directDestinationCity: string | null;
  allowCrossZoneSales: boolean;
  active: boolean;
  zones: Zone[];
  distribution: { destination: string; count: number }[];
};
type Leg = {
  id: string;
  order: number;
  label: string;
  fromStopId: string | null;
  toStopId: string | null;
  assignments: Assignment[];
};
type OpsData = {
  departure: { id: string; date: string; stops: { id: string; city: string; sortOrder: number }[] };
  legs: Leg[];
};
type BusOption = { id: string; plate: string; model: string | null; seatCount: number };

export default function DepartureOps({ departureId }: { departureId: string }) {
  const [data, setData] = useState<OpsData | null>(null);
  const [buses, setBuses] = useState<BusOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [swapBusId, setSwapBusId] = useState("");
  const [addBusFor, setAddBusFor] = useState<string | null>(null);
  const [addBusId, setAddBusId] = useState("");
  const [newLegLabel, setNewLegLabel] = useState("");
  const [newLegFrom, setNewLegFrom] = useState("");
  const [newLegTo, setNewLegTo] = useState("");
  const [zoneFor, setZoneFor] = useState<string | null>(null);
  const [zoneName, setZoneName] = useState("");
  const [zoneFrom, setZoneFrom] = useState("");
  const [zoneTo, setZoneTo] = useState("");
  const [zoneGroup, setZoneGroup] = useState("");

  const load = async () => {
    const res = await fetch(`/api/admin/departures/${departureId}/legs`);
    const json = await res.json();
    if (res.ok) setData(json);
    else setError(json.error ?? "Не вдалося завантажити плечі");
  };

  useEffect(() => {
    void load();
    fetch("/api/admin/buses")
      .then((r) => r.json())
      .then((json) => setBuses(json.buses ?? []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departureId]);

  const call = async (url: string, method: string, body?: unknown) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Помилка");
      await load();
      return json;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const swap = async (assignmentId: string) => {
    const json = await call(`/api/admin/assignments/${assignmentId}/swap`, "POST", {
      newBusId: swapBusId,
    });
    if (json?.result) {
      const r = json.result;
      setMessage(
        `Автобус замінено: ${r.kept} місць збережено, ${r.remapped.length} перенесено` +
          (r.remapped.length
            ? ` (${r.remapped.map((x: { from: number; to: number }) => `${x.from}→${x.to}`).join(", ")})`
            : "")
      );
      setSwapFor(null);
    }
  };

  if (!data) {
    return <p className="mt-3 text-xs text-slate-500">Завантаження операційної схеми…</p>;
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Операційна схема (плечі й автобуси)
      </p>

      {data.legs.map((leg) => (
        <div key={leg.id} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <p className="text-sm font-semibold text-slate-900">
            Плече {leg.order}: {leg.label}
          </p>
          <ul className="mt-2 space-y-2">
            {leg.assignments.map((a) => (
              <li key={a.id} className="rounded-lg border border-slate-100 p-2.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono font-semibold text-slate-900">
                    {a.busPlate}
                  </span>
                  <span className="text-slate-500">{a.busModel ?? ""}</span>
                  <span className="tabular-nums text-slate-600">
                    {a.sold}/{a.capacity} продано · {a.free} вільно
                  </span>
                  {!a.active ? (
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                      вимкнено
                    </span>
                  ) : null}
                  {a.isDirect ? (
                    <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
                      direct → {a.directDestinationCity ?? "?"}
                    </span>
                  ) : null}
                  <span className="ml-auto flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      className="text-brand-700"
                      onClick={() => {
                        setSwapFor(swapFor === a.id ? null : a.id);
                        setSwapBusId("");
                      }}
                    >
                      Змінити автобус
                    </button>
                    <button
                      type="button"
                      className="text-slate-600"
                      onClick={() =>
                        void call(`/api/admin/assignments/${a.id}`, "PATCH", {
                          isDirect: !a.isDirect,
                          directDestinationCity: a.directDestinationCity,
                        })
                      }
                    >
                      {a.isDirect ? "вимкнути direct" : "direct"}
                    </button>
                    <button
                      type="button"
                      className="text-slate-600"
                      onClick={() => setZoneFor(zoneFor === a.id ? null : a.id)}
                    >
                      Зони ({a.zones.length})
                    </button>
                  </span>
                </div>

                {a.distribution.length > 0 ? (
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Напрямки пасажирів:{" "}
                    {a.distribution.map((d) => `${d.destination} — ${d.count}`).join(" · ")}
                  </p>
                ) : null}

                {a.isDirect ? (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Прямий до:</span>
                    <input
                      className={`${inputClass} w-40`}
                      defaultValue={a.directDestinationCity ?? ""}
                      placeholder="Місто призначення"
                      onBlur={(e) =>
                        void call(`/api/admin/assignments/${a.id}`, "PATCH", {
                          isDirect: true,
                          directDestinationCity: e.target.value,
                        })
                      }
                    />
                  </div>
                ) : null}

                {swapFor === a.id ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2 text-xs">
                    <select
                      className={`${inputClass} w-56`}
                      value={swapBusId}
                      onChange={(e) => setSwapBusId(e.target.value)}
                    >
                      <option value="">— новий автобус —</option>
                      {buses
                        .filter((b) => b.id !== a.busId)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.plate} · {b.model ?? ""} · {b.seatCount} місць
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      className={btnPrimary}
                      disabled={busy || !swapBusId}
                      onClick={() => void swap(a.id)}
                    >
                      Замінити (місця перенесуться)
                    </button>
                    <span className="text-slate-400">
                      Дозволено, якщо місць ≥ проданих ({a.sold})
                    </span>
                  </div>
                ) : null}

                {zoneFor === a.id ? (
                  <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs">
                    {a.zones.length ? (
                      <ul className="mb-2 space-y-1">
                        {a.zones.map((z) => (
                          <li key={z.id} className="flex items-center gap-2">
                            <span className="font-medium">{z.name}</span>
                            <span className="tabular-nums text-slate-500">
                              місця {z.fromSeat}–{z.toSeat}
                            </span>
                            {z.groupLabel ? (
                              <span className="text-slate-500">→ {z.groupLabel}</span>
                            ) : null}
                            <button
                              type="button"
                              className="ml-auto text-rose-600"
                              onClick={() =>
                                void call(`/api/admin/assignments/${a.id}/zones`, "DELETE", {
                                  zoneId: z.id,
                                })
                              }
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mb-2 text-slate-400">Зон немає — усі місця доступні всім.</p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input className={`${inputClass} w-28`} placeholder="Назва" value={zoneName} onChange={(e) => setZoneName(e.target.value)} />
                      <input className={`${inputClass} w-16`} placeholder="з" type="number" value={zoneFrom} onChange={(e) => setZoneFrom(e.target.value)} />
                      <input className={`${inputClass} w-16`} placeholder="по" type="number" value={zoneTo} onChange={(e) => setZoneTo(e.target.value)} />
                      <input className={`${inputClass} w-32`} placeholder="Група напрямків" value={zoneGroup} onChange={(e) => setZoneGroup(e.target.value)} />
                      <button
                        type="button"
                        className={btnGhost}
                        disabled={busy}
                        onClick={async () => {
                          const json = await call(`/api/admin/assignments/${a.id}/zones`, "POST", {
                            name: zoneName,
                            fromSeat: Number(zoneFrom),
                            toSeat: Number(zoneTo),
                            groupLabel: zoneGroup || undefined,
                          });
                          if (json) {
                            setZoneName("");
                            setZoneFrom("");
                            setZoneTo("");
                            setZoneGroup("");
                          }
                        }}
                      >
                        + зона
                      </button>
                      <label className="flex items-center gap-1 text-slate-600">
                        <input
                          type="checkbox"
                          checked={a.allowCrossZoneSales}
                          onChange={(e) =>
                            void call(`/api/admin/assignments/${a.id}`, "PATCH", {
                              allowCrossZoneSales: e.target.checked,
                            })
                          }
                        />
                        cross-zone продаж
                      </label>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {addBusFor === leg.id ? (
              <>
                <select
                  className={`${inputClass} w-56`}
                  value={addBusId}
                  onChange={(e) => setAddBusId(e.target.value)}
                >
                  <option value="">— автобус —</option>
                  {buses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.plate} · {b.model ?? ""} · {b.seatCount} місць
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={busy || !addBusId}
                  onClick={async () => {
                    const json = await call(`/api/admin/legs/${leg.id}/assignments`, "POST", {
                      busId: addBusId,
                    });
                    if (json) setAddBusFor(null);
                  }}
                >
                  Додати на плече
                </button>
              </>
            ) : (
              <button
                type="button"
                className="text-brand-700"
                onClick={() => setAddBusFor(leg.id)}
              >
                + Додати автобус на плече
              </button>
            )}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <input
          className={`${inputClass} w-48`}
          placeholder="Назва нового плеча"
          value={newLegLabel}
          onChange={(e) => setNewLegLabel(e.target.value)}
        />
        <select className={`${inputClass} w-36`} value={newLegFrom} onChange={(e) => setNewLegFrom(e.target.value)}>
          <option value="">від (початок)</option>
          {data.departure.stops.map((s) => (
            <option key={s.id} value={s.id}>{s.city}</option>
          ))}
        </select>
        <select className={`${inputClass} w-36`} value={newLegTo} onChange={(e) => setNewLegTo(e.target.value)}>
          <option value="">до (кінець)</option>
          {data.departure.stops.map((s) => (
            <option key={s.id} value={s.id}>{s.city}</option>
          ))}
        </select>
        <button
          type="button"
          className={btnGhost}
          disabled={busy || !newLegLabel.trim()}
          onClick={async () => {
            const json = await call(`/api/admin/departures/${departureId}/legs`, "POST", {
              label: newLegLabel,
              fromStopId: newLegFrom || undefined,
              toStopId: newLegTo || undefined,
            });
            if (json) setNewLegLabel("");
          }}
        >
          + Додати плече
        </button>
      </div>

      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
