"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Field, { btnGhost, btnPrimary, inputClass } from "@/components/admin/Field";
import { WEEKDAYS } from "@/lib/routes/weekdays";
import type { TemplateDTO } from "@/lib/routes/serialize";
import type { CountryOption } from "@/components/admin/RouteTemplatesList";

type StopForm = {
  id?: string;
  sortOrder: number;
  city: string;
  outboundDay: number;
  outboundTime: string;
  returnDay: number;
  returnTime: string;
  addressLabel: string;
  boardingAddress: string;
  latitude: string;
  longitude: string;
  visibleByDefault: boolean;
};

type FormState = {
  countryId: string;
  name: string;
  originCity: string;
  destinationCity: string;
  departureWeekdays: number[];
  busPhone: string;
  dispatcherPhone: string;
  ukraineDepartureWeekday: string;
  ukraineReturnWeekday: string;
  defaultBus: string;
  comment: string;
  isActive: boolean;
  stops: StopForm[];
};

function emptyStop(order: number): StopForm {
  return {
    sortOrder: order,
    city: "",
    outboundDay: 1,
    outboundTime: "08:00",
    returnDay: 1,
    returnTime: "20:00",
    addressLabel: "",
    boardingAddress: "",
    latitude: "",
    longitude: "",
    visibleByDefault: true,
  };
}

function fromTemplate(t: TemplateDTO): FormState {
  return {
    countryId: t.countryId,
    name: t.name,
    originCity: t.originCity,
    destinationCity: t.destinationCity,
    departureWeekdays: t.departureWeekdays,
    busPhone: t.busPhone ?? "",
    dispatcherPhone: t.dispatcherPhone ?? "",
    ukraineDepartureWeekday:
      t.ukraineDepartureWeekday != null ? String(t.ukraineDepartureWeekday) : "",
    ukraineReturnWeekday:
      t.ukraineReturnWeekday != null ? String(t.ukraineReturnWeekday) : "",
    defaultBus: t.defaultBus ?? "",
    comment: t.comment ?? "",
    isActive: t.isActive,
    stops: t.stops.map((s) => ({
      id: s.id,
      sortOrder: s.sortOrder,
      city: s.city,
      outboundDay: s.outboundDay,
      outboundTime: s.outboundTime,
      returnDay: s.returnDay,
      returnTime: s.returnTime,
      addressLabel: s.addressLabel ?? "",
      boardingAddress: s.boardingAddress ?? "",
      latitude: s.latitude == null ? "" : String(s.latitude),
      longitude: s.longitude == null ? "" : String(s.longitude),
      visibleByDefault: s.visibleByDefault,
    })),
  };
}

const EMPTY: FormState = {
  countryId: "",
  name: "",
  originCity: "",
  destinationCity: "",
  departureWeekdays: [],
  busPhone: "",
  dispatcherPhone: "",
  ukraineDepartureWeekday: "",
  ukraineReturnWeekday: "",
  defaultBus: "",
  comment: "",
  isActive: true,
  stops: [emptyStop(1), emptyStop(2)],
};

type Props = {
  countries: CountryOption[];
  template?: TemplateDTO | null;
};

export default function RouteTemplateEditor({ countries, template }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<FormState>(() =>
    template ? fromTemplate(template) : { ...EMPTY, countryId: countries[0]?.id ?? "" }
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [propagate, setPropagate] = useState(false);
  const [propagateFrom, setPropagateFrom] = useState("");
  const [propagateTo, setPropagateTo] = useState("");
  const [genFrom, setGenFrom] = useState("");
  const [genTo, setGenTo] = useState("");

  const isEdit = Boolean(template?.id);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
  };

  const autoName = useMemo(() => {
    if (values.originCity && values.destinationCity) {
      return `${values.originCity} — ${values.destinationCity}`;
    }
    return values.name;
  }, [values.originCity, values.destinationCity, values.name]);

  const toggleDay = (id: number) => {
    setValues((v) => ({
      ...v,
      departureWeekdays: v.departureWeekdays.includes(id)
        ? v.departureWeekdays.filter((d) => d !== id)
        : [...v.departureWeekdays, id].sort((a, b) => a - b),
    }));
  };

  const updateStop = (index: number, patch: Partial<StopForm>) => {
    setValues((v) => ({
      ...v,
      stops: v.stops.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  };

  const addStop = () => {
    setValues((v) => ({
      ...v,
      stops: [...v.stops, emptyStop(v.stops.length + 1)],
    }));
  };

  const removeStop = (index: number) => {
    setValues((v) => ({
      ...v,
      stops: v.stops
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, sortOrder: i + 1 })),
    }));
  };

  const moveStop = (index: number, dir: -1 | 1) => {
    setValues((v) => {
      const next = [...v.stops];
      const target = index + dir;
      if (target < 0 || target >= next.length) return v;
      [next[index], next[target]] = [next[target], next[index]];
      return {
        ...v,
        stops: next.map((s, i) => ({ ...s, sortOrder: i + 1 })),
      };
    });
  };

  const payload = () => ({
    countryId: values.countryId,
    name: values.name.trim() || autoName,
    originCity: values.originCity,
    destinationCity: values.destinationCity,
    departureWeekdays: values.departureWeekdays,
    busPhone: values.busPhone,
    dispatcherPhone: values.dispatcherPhone,
    ukraineDepartureWeekday: values.ukraineDepartureWeekday
      ? Number(values.ukraineDepartureWeekday)
      : null,
    ukraineReturnWeekday: values.ukraineReturnWeekday
      ? Number(values.ukraineReturnWeekday)
      : null,
    defaultBus: values.defaultBus,
    comment: values.comment,
    isActive: values.isActive,
    stops: values.stops.map((s, i) => ({
      id: s.id,
      sortOrder: Number(s.sortOrder) || i + 1,
      city: s.city,
      outboundDay: Number(s.outboundDay),
      outboundTime: s.outboundTime,
      returnDay: Number(s.returnDay),
      returnTime: s.returnTime,
      addressLabel: s.addressLabel,
      boardingAddress: s.boardingAddress,
      latitude: s.latitude.trim() === "" ? null : Number(s.latitude),
      longitude: s.longitude.trim() === "" ? null : Number(s.longitude),
      visibleByDefault: s.visibleByDefault,
    })),
    propagate: isEdit
      ? {
          enabled: propagate,
          from: propagateFrom,
          to: propagateTo,
        }
      : undefined,
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const res = await fetch(
        isEdit
          ? `/api/admin/route-templates/${template!.id}`
          : "/api/admin/route-templates",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload()),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Не вдалося зберегти");
      const extra =
        typeof data.propagated === "number" && data.propagated > 0
          ? ` Оновлено виїздів: ${data.propagated}.`
          : "";
      if (isEdit) {
        setMessage(`Збережено.${extra}`);
        router.refresh();
      } else {
        router.push(`/cabinet/routes/${data.template.id}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    if (!template?.id) return;
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/route-templates/${template.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: genFrom, to: genTo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Не вдалося створити виїзди");
      setMessage(
        `Створено виїздів: ${data.created}. Пропущено (вже були): ${data.skipped}.`
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="text-base font-semibold text-slate-900">Маршрут</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Країна">
            <select
              required
              className={inputClass}
              value={values.countryId}
              onChange={(e) => setField("countryId", e.target.value)}
            >
              <option value="">Оберіть країну</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Початковий пункт">
            <input
              required
              className={inputClass}
              value={values.originCity}
              onChange={(e) => setField("originCity", e.target.value)}
              placeholder="Київ"
            />
          </Field>
          <Field label="Кінцевий пункт">
            <input
              required
              className={inputClass}
              value={values.destinationCity}
              onChange={(e) => setField("destinationCity", e.target.value)}
              placeholder="Марбелья"
            />
          </Field>
          <Field label="Назва маршруту" hint="Якщо порожня — з початкового і кінцевого пункту">
            <input
              className={inputClass}
              value={values.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder={autoName || "Київ — Марбелья"}
            />
          </Field>
          <Field label="Автобус за замовчуванням">
            <input
              className={inputClass}
              value={values.defaultBus}
              onChange={(e) => setField("defaultBus", e.target.value)}
              placeholder="Mercedes Tourismo AA 1234"
            />
          </Field>
          <Field label="Телефон автобуса">
            <input
              className={inputClass}
              value={values.busPhone}
              onChange={(e) => setField("busPhone", e.target.value)}
              placeholder="+380..."
            />
          </Field>
          <Field label="Телефон диспетчера">
            <input
              className={inputClass}
              value={values.dispatcherPhone}
              onChange={(e) => setField("dispatcherPhone", e.target.value)}
              placeholder="+380..."
            />
          </Field>
          <Field label="День виїзду з України">
            <select
              className={inputClass}
              value={values.ukraineDepartureWeekday}
              onChange={(e) => setField("ukraineDepartureWeekday", e.target.value)}
            >
              <option value="">—</option>
              {WEEKDAYS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full}
                </option>
              ))}
            </select>
          </Field>
          <Field label="День повернення в Україну">
            <select
              className={inputClass}
              value={values.ukraineReturnWeekday}
              onChange={(e) => setField("ukraineReturnWeekday", e.target.value)}
            >
              <option value="">—</option>
              {WEEKDAYS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-slate-600">
            Дні виїзду (для створення виїздів на рік уперед)
          </p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <label
                key={d.id}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                  values.departureWeekdays.includes(d.id)
                    ? "border-brand-300 bg-brand-50 text-brand-800"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                <input
                  type="checkbox"
                  checked={values.departureWeekdays.includes(d.id)}
                  onChange={() => toggleDay(d.id)}
                />
                {d.short}
              </label>
            ))}
          </div>
        </div>

        <Field label="Коментар до маршруту">
          <textarea
            className="mt-1 min-h-[72px] w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={values.comment}
            onChange={(e) => setField("comment", e.target.value)}
          />
        </Field>

        <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(e) => setField("isActive", e.target.checked)}
          />
          Активний шаблон
        </label>
      </section>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Конструктор графіка
            </h2>
            <p className="text-xs text-slate-500">
              Міста по черзі від початкового пункту до кінцевого. День — номер дня
              маршруту (1, 2, …), бо рейс може тривати 2–5 днів.
            </p>
          </div>
          <button type="button" onClick={addStop} className={btnGhost}>
            Додати місто
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-xs">
            <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-2">№</th>
                <th className="px-2 py-2">Місто</th>
                <th className="px-2 py-2">День туди</th>
                <th className="px-2 py-2">Час туди</th>
                <th className="px-2 py-2">День назад</th>
                <th className="px-2 py-2">Час назад</th>
                <th className="px-2 py-2">Підпис адреси</th>
                <th className="px-2 py-2">Адреса / координати</th>
                <th className="px-2 py-2">У виїздах</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {values.stops.map((stop, index) => (
                <tr key={stop.id ?? `new-${index}`} className="border-t border-slate-100">
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={1}
                      className="h-8 w-14 rounded border border-slate-300 px-1"
                      value={stop.sortOrder}
                      onChange={(e) =>
                        updateStop(index, { sortOrder: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      required
                      className="h-8 w-32 rounded border border-slate-300 px-1"
                      value={stop.city}
                      onChange={(e) => updateStop(index, { city: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={1}
                      max={14}
                      className="h-8 w-16 rounded border border-slate-300 px-1"
                      value={stop.outboundDay}
                      onChange={(e) =>
                        updateStop(index, { outboundDay: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="time"
                      className="h-8 rounded border border-slate-300 px-1"
                      value={stop.outboundTime}
                      onChange={(e) =>
                        updateStop(index, { outboundTime: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={1}
                      max={14}
                      className="h-8 w-16 rounded border border-slate-300 px-1"
                      value={stop.returnDay}
                      onChange={(e) =>
                        updateStop(index, { returnDay: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="time"
                      className="h-8 rounded border border-slate-300 px-1"
                      value={stop.returnTime}
                      onChange={(e) =>
                        updateStop(index, { returnTime: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      className="h-8 w-36 rounded border border-slate-300 px-1"
                      value={stop.addressLabel}
                      onChange={(e) =>
                        updateStop(index, { addressLabel: e.target.value })
                      }
                      placeholder="Автовокзал"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      className="mb-1 h-8 w-44 rounded border border-slate-300 px-1"
                      value={stop.boardingAddress}
                      onChange={(e) =>
                        updateStop(index, { boardingAddress: e.target.value })
                      }
                      placeholder="вул. Вокзальна, 1"
                    />
                    <div className="flex gap-1">
                      <input
                        className="h-8 w-[5.5rem] rounded border border-slate-300 px-1"
                        value={stop.latitude}
                        onChange={(e) =>
                          updateStop(index, { latitude: e.target.value })
                        }
                        placeholder="lat"
                      />
                      <input
                        className="h-8 w-[5.5rem] rounded border border-slate-300 px-1"
                        value={stop.longitude}
                        onChange={(e) =>
                          updateStop(index, { longitude: e.target.value })
                        }
                        placeholder="lng"
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={stop.visibleByDefault}
                        onChange={(e) =>
                          updateStop(index, { visibleByDefault: e.target.checked })
                        }
                      />
                      показувати
                    </label>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      className="mr-1 text-slate-500"
                      onClick={() => moveStop(index, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="mr-1 text-slate-500"
                      onClick={() => moveStop(index, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="text-rose-700"
                      onClick={() => removeStop(index)}
                      disabled={values.stops.length <= 2}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isEdit ? (
        <section className="rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200">
          <label className="flex items-start gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              className="mt-1"
              checked={propagate}
              onChange={(e) => setPropagate(e.target.checked)}
            />
            <span>
              Застосувати нові дані шаблону (міста, телефони, автобус, коментар,
              видимість міст) до вже створених виїздів цього маршруту в обраний
              період.
            </span>
          </label>
          {propagate ? (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Період з">
                <input
                  type="date"
                  required={propagate}
                  className={inputClass}
                  value={propagateFrom}
                  onChange={(e) => setPropagateFrom(e.target.value)}
                />
              </Field>
              <Field label="Період до">
                <input
                  type="date"
                  required={propagate}
                  className={inputClass}
                  value={propagateTo}
                  onChange={(e) => setPropagateTo(e.target.value)}
                />
              </Field>
            </div>
          ) : null}
        </section>
      ) : null}

      {isEdit ? (
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            Створити виїзди наперед
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            За днями виїзду шаблону створюються виїзди на кожну відповідну дату.
            Міста копіюються з шаблону; приховані за замовчуванням міста одразу
            не показуються.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Від">
              <input
                type="date"
                className={inputClass}
                value={genFrom}
                onChange={(e) => setGenFrom(e.target.value)}
              />
            </Field>
            <Field label="До">
              <input
                type="date"
                className={inputClass}
                value={genTo}
                onChange={(e) => setGenTo(e.target.value)}
              />
            </Field>
            <div className="flex items-end">
              <button
                type="button"
                className={btnGhost}
                disabled={busy || !genFrom || !genTo}
                onClick={generate}
              >
                Згенерувати виїзди
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? "Збереження…" : isEdit ? "Зберегти шаблон" : "Створити шаблон"}
        </button>
        <button
          type="button"
          className={btnGhost}
          onClick={() => router.push("/cabinet/routes")}
        >
          Назад до списку
        </button>
      </div>
    </form>
  );
}
