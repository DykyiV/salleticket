"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const WEEKDAYS: { id: number; label: string }[] = [
  { id: 1, label: "Пн" },
  { id: 2, label: "Вт" },
  { id: 3, label: "Ср" },
  { id: 4, label: "Чт" },
  { id: 5, label: "Пт" },
  { id: 6, label: "Сб" },
  { id: 7, label: "Нд" },
];

export type StopRow = {
  city: string;
  address: string | null;
  offsetMinutes: number;
  isPickup: boolean;
  isDropoff: boolean;
};

export type RouteRow = {
  id: string;
  name: string;
  fromCity: string;
  toCity: string;
  carrierId: string;
  carrierName: string;
  departureTime: string;
  daysOfWeek: string;
  basePrice: number;
  busCapacity: number;
  busType: string;
  amenities: string;
  isActive: boolean;
  stops: StopRow[];
  createdAt: string;
};

type FormValues = {
  name: string;
  fromCity: string;
  toCity: string;
  carrierName: string;
  departureTime: string;
  daysOfWeek: number[];
  basePrice: string;
  busCapacity: string;
  busType: string;
  amenities: string;
  isActive: boolean;
  stops: StopRow[];
};

const EMPTY_STOP: StopRow = {
  city: "",
  address: "",
  offsetMinutes: 0,
  isPickup: true,
  isDropoff: true,
};

const EMPTY: FormValues = {
  name: "",
  fromCity: "",
  toCity: "",
  carrierName: "",
  departureTime: "08:00",
  daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
  basePrice: "",
  busCapacity: "45",
  busType: "Autobus",
  amenities: "",
  isActive: true,
  stops: [{ ...EMPTY_STOP }],
};

function rowToForm(r: RouteRow): FormValues {
  return {
    name: r.name,
    fromCity: r.fromCity,
    toCity: r.toCity,
    carrierName: r.carrierName,
    departureTime: r.departureTime,
    daysOfWeek: r.daysOfWeek
      .split(",")
      .map((d) => Number.parseInt(d, 10))
      .filter((n) => !Number.isNaN(n)),
    basePrice: String(r.basePrice),
    busCapacity: String(r.busCapacity),
    busType: r.busType,
    amenities: r.amenities,
    isActive: r.isActive,
    stops: r.stops.length > 0 ? r.stops.map((s) => ({ ...s })) : [{ ...EMPTY_STOP }],
  };
}

function formToPayload(v: FormValues) {
  return {
    name: v.name.trim(),
    fromCity: v.fromCity.trim(),
    toCity: v.toCity.trim(),
    carrierName: v.carrierName.trim(),
    departureTime: v.departureTime,
    daysOfWeek: v.daysOfWeek,
    basePrice: v.basePrice.trim(),
    busCapacity: v.busCapacity.trim(),
    busType: v.busType.trim() || "Autobus",
    amenities: v.amenities
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean),
    isActive: v.isActive,
    stops: v.stops.map((s) => ({
      city: s.city.trim(),
      address: s.address?.trim() || null,
      offsetMinutes: s.offsetMinutes,
      isPickup: s.isPickup,
      isDropoff: s.isDropoff,
    })),
  };
}

function formatDays(csv: string): string {
  const days = new Set(csv.split(",").map((d) => d.trim()));
  return WEEKDAYS.filter((w) => days.has(String(w.id)))
    .map((w) => w.label)
    .join(", ");
}

type Props = {
  initialRoutes: RouteRow[];
};

export default function RoutesAdmin({ initialRoutes }: Props) {
  const router = useRouter();
  const [routes, setRoutes] = useState<RouteRow[]>(initialRoutes);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isEditing = editingId !== null;

  const sorted = useMemo(
    () => [...routes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [routes]
  );

  const setField = <K extends keyof FormValues>(field: K, value: FormValues[K]) => {
    setValues((v) => ({ ...v, [field]: value }));
  };

  const resetForm = () => {
    setEditingId(null);
    setValues(EMPTY);
    setError(null);
  };

  const startEdit = (row: RouteRow) => {
    setEditingId(row.id);
    setValues(rowToForm(row));
    setError(null);
  };

  const toggleDay = (day: number) => {
    setValues((v) => ({
      ...v,
      daysOfWeek: v.daysOfWeek.includes(day)
        ? v.daysOfWeek.filter((d) => d !== day)
        : [...v.daysOfWeek, day].sort(),
    }));
  };

  const updateStop = (index: number, patch: Partial<StopRow>) => {
    setValues((v) => ({
      ...v,
      stops: v.stops.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  };

  const addStop = () => {
    setValues((v) => ({ ...v, stops: [...v.stops, { ...EMPTY_STOP }] }));
  };

  const removeStop = (index: number) => {
    setValues((v) => ({
      ...v,
      stops: v.stops.length > 1 ? v.stops.filter((_, i) => i !== index) : v.stops,
    }));
  };

  const moveStop = (index: number, dir: -1 | 1) => {
    setValues((v) => {
      const next = [...v.stops];
      const target = index + dir;
      if (target < 0 || target >= next.length) return v;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...v, stops: next };
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = formToPayload(values);
      const res = await fetch(
        isEditing ? `/api/admin/routes/${editingId}` : "/api/admin/routes",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Request failed");
      const updated = toRow(data.route);
      setRoutes((list) =>
        isEditing
          ? list.map((r) => (r.id === updated.id ? updated : r))
          : [updated, ...list]
      );
      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (row: RouteRow) => {
    const next = !row.isActive;
    setRoutes((list) =>
      list.map((r) => (r.id === row.id ? { ...r, isActive: next } : r))
    );
    try {
      const res = await fetch(`/api/admin/routes/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to toggle");
      }
    } catch (err) {
      setRoutes((list) =>
        list.map((r) => (r.id === row.id ? { ...r, isActive: !next } : r))
      );
      setError(err instanceof Error ? err.message : "Failed to toggle");
    }
  };

  const deleteRow = async (row: RouteRow) => {
    if (!window.confirm(`Видалити маршрут "${row.name}"?`)) return;
    const snapshot = routes;
    setRoutes((list) => list.filter((r) => r.id !== row.id));
    try {
      const res = await fetch(`/api/admin/routes/${row.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to delete");
      }
      if (editingId === row.id) resetForm();
    } catch (err) {
      setRoutes(snapshot);
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded border border-slate-300 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="border-b border-slate-300 px-3 py-2">Маршрут</th>
              <th className="border-b border-slate-300 px-3 py-2">Перевізник</th>
              <th className="border-b border-slate-300 px-3 py-2">Відправлення</th>
              <th className="border-b border-slate-300 px-3 py-2">Дні</th>
              <th className="border-b border-slate-300 px-3 py-2">Зупинки</th>
              <th className="border-b border-slate-300 px-3 py-2">Ціна</th>
              <th className="border-b border-slate-300 px-3 py-2">Місць</th>
              <th className="border-b border-slate-300 px-3 py-2">Активний</th>
              <th className="border-b border-slate-300 px-3 py-2 text-right">Дії</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={9}>
                  Маршрутів ще немає.
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr
                  key={row.id}
                  className={
                    editingId === row.id ? "bg-yellow-50" : "odd:bg-white even:bg-slate-50"
                  }
                >
                  <td className="border-t border-slate-200 px-3 py-2">
                    <p className="font-medium text-slate-900">{row.name}</p>
                    <p className="text-xs text-slate-500">
                      {row.fromCity} → {row.toCity}
                    </p>
                  </td>
                  <td className="border-t border-slate-200 px-3 py-2">{row.carrierName}</td>
                  <td className="border-t border-slate-200 px-3 py-2 tabular-nums">
                    {row.departureTime}
                  </td>
                  <td className="border-t border-slate-200 px-3 py-2">
                    {formatDays(row.daysOfWeek)}
                  </td>
                  <td className="border-t border-slate-200 px-3 py-2">
                    {row.stops.length}
                  </td>
                  <td className="border-t border-slate-200 px-3 py-2 tabular-nums">
                    €{row.basePrice.toFixed(2)}
                  </td>
                  <td className="border-t border-slate-200 px-3 py-2 tabular-nums">
                    {row.busCapacity}
                  </td>
                  <td className="border-t border-slate-200 px-3 py-2">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={row.isActive}
                        onChange={() => toggleActive(row)}
                      />
                      <span className={row.isActive ? "text-slate-900" : "text-slate-400"}>
                        {row.isActive ? "так" : "ні"}
                      </span>
                    </label>
                  </td>
                  <td className="border-t border-slate-200 px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      className="mr-2 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    >
                      Редагувати
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteRow(row)}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-rose-700"
                    >
                      Видалити
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleSubmit} className="rounded border border-slate-300 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {isEditing ? "Редагувати маршрут" : "Створити маршрут"}
          </h2>
          {isEditing ? (
            <button type="button" onClick={resetForm} className="text-xs text-slate-600 underline">
              Скасувати
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Назва маршруту">
            <input
              type="text"
              value={values.name}
              onChange={(e) => setField("name", e.target.value)}
              required
              placeholder="Вінниця — Севілья"
              className="h-9 w-full rounded border border-slate-300 px-2"
            />
          </Field>

          <Field label="Звідки">
            <input
              type="text"
              value={values.fromCity}
              onChange={(e) => setField("fromCity", e.target.value)}
              required
              placeholder="Вінниця"
              className="h-9 w-full rounded border border-slate-300 px-2"
            />
          </Field>

          <Field label="Куди">
            <input
              type="text"
              value={values.toCity}
              onChange={(e) => setField("toCity", e.target.value)}
              required
              placeholder="Севілья"
              className="h-9 w-full rounded border border-slate-300 px-2"
            />
          </Field>

          <Field label="Перевізник">
            <input
              type="text"
              value={values.carrierName}
              onChange={(e) => setField("carrierName", e.target.value)}
              required
              placeholder="Grandes Tour"
              className="h-9 w-full rounded border border-slate-300 px-2"
            />
          </Field>

          <Field label="Час відправлення (перша зупинка)">
            <input
              type="time"
              value={values.departureTime}
              onChange={(e) => setField("departureTime", e.target.value)}
              required
              className="h-9 w-full rounded border border-slate-300 px-2"
            />
          </Field>

          <Field label="Базова ціна (EUR)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={values.basePrice}
              onChange={(e) => setField("basePrice", e.target.value)}
              required
              placeholder="35.00"
              className="h-9 w-full rounded border border-slate-300 px-2"
            />
          </Field>

          <Field label="Місткість автобуса">
            <input
              type="number"
              min="1"
              step="1"
              value={values.busCapacity}
              onChange={(e) => setField("busCapacity", e.target.value)}
              required
              className="h-9 w-full rounded border border-slate-300 px-2"
            />
          </Field>

          <Field label="Тип автобуса">
            <input
              type="text"
              value={values.busType}
              onChange={(e) => setField("busType", e.target.value)}
              placeholder="Mercedes Tourismo"
              className="h-9 w-full rounded border border-slate-300 px-2"
            />
          </Field>

          <Field label="Зручності (через кому)">
            <input
              type="text"
              value={values.amenities}
              onChange={(e) => setField("amenities", e.target.value)}
              placeholder="Wi-Fi, USB, A/C"
              className="h-9 w-full rounded border border-slate-300 px-2"
            />
          </Field>
        </div>

        <div className="mt-4">
          <span className="mb-2 block text-xs font-medium text-slate-600">
            Дні відправлення
          </span>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((w) => (
              <label
                key={w.id}
                className={`flex h-9 w-12 cursor-pointer items-center justify-center rounded border text-sm ${
                  values.daysOfWeek.includes(w.id)
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-300 bg-white text-slate-500"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={values.daysOfWeek.includes(w.id)}
                  onChange={() => toggleDay(w.id)}
                />
                {w.label}
              </label>
            ))}
          </div>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(e) => setField("isActive", e.target.checked)}
          />
          Активний (генерує рейси на майбутні дати)
        </label>

        <div className="mt-5 border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">
              Зупинки (по порядку)
            </span>
            <button
              type="button"
              onClick={addStop}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
            >
              + Додати зупинку
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {values.stops.map((stop, index) => (
              <div
                key={index}
                className="grid grid-cols-1 items-end gap-2 rounded border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-[1fr_1fr_100px_auto_auto_auto]"
              >
                <Field label={`Місто #${index + 1}`}>
                  <input
                    type="text"
                    value={stop.city}
                    onChange={(e) => updateStop(index, { city: e.target.value })}
                    required
                    placeholder="Київ"
                    className="h-9 w-full rounded border border-slate-300 px-2"
                  />
                </Field>
                <Field label="Адреса посадки">
                  <input
                    type="text"
                    value={stop.address ?? ""}
                    onChange={(e) => updateStop(index, { address: e.target.value })}
                    placeholder="АВ, вул. Курчатова, 10"
                    className="h-9 w-full rounded border border-slate-300 px-2"
                  />
                </Field>
                <Field label="Хв. від старту">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={stop.offsetMinutes}
                    onChange={(e) =>
                      updateStop(index, { offsetMinutes: Number.parseInt(e.target.value, 10) || 0 })
                    }
                    className="h-9 w-full rounded border border-slate-300 px-2"
                  />
                </Field>
                <label className="flex h-9 items-center gap-1 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={stop.isPickup}
                    onChange={(e) => updateStop(index, { isPickup: e.target.checked })}
                  />
                  Посадка
                </label>
                <label className="flex h-9 items-center gap-1 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={stop.isDropoff}
                    onChange={(e) => updateStop(index, { isDropoff: e.target.checked })}
                  />
                  Висадка
                </label>
                <div className="flex h-9 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveStop(index, -1)}
                    disabled={index === 0}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStop(index, 1)}
                    disabled={index === values.stops.length - 1}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs disabled:opacity-40"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStop(index)}
                    disabled={values.stops.length <= 1}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-rose-700 disabled:opacity-40"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitting ? "Збереження…" : isEditing ? "Зберегти зміни" : "Створити маршрут"}
          </button>
        </div>
      </form>
    </div>
  );
}

type ApiRoute = {
  id: string;
  name: string;
  fromCity: string;
  toCity: string;
  departureTime: string;
  daysOfWeek: string;
  basePrice: number;
  busCapacity: number;
  busType: string;
  amenities: string;
  isActive: boolean;
  createdAt: string;
  carrier: { id: string; name: string };
  stops: {
    city: string;
    address: string | null;
    offsetMinutes: number;
    isPickup: boolean;
    isDropoff: boolean;
  }[];
};

function toRow(r: ApiRoute): RouteRow {
  return {
    id: r.id,
    name: r.name,
    fromCity: r.fromCity,
    toCity: r.toCity,
    carrierId: r.carrier.id,
    carrierName: r.carrier.name,
    departureTime: r.departureTime,
    daysOfWeek: r.daysOfWeek,
    basePrice: r.basePrice,
    busCapacity: r.busCapacity,
    busType: r.busType,
    amenities: r.amenities,
    isActive: r.isActive,
    stops: r.stops,
    createdAt: r.createdAt,
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
