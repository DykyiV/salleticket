"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost, btnPrimary, inputClass } from "@/components/admin/Field";

type Tier = { share: number; price: number };

export type TariffCountry = {
  id: string;
  name: string;
  code: string | null;
  grid: {
    id: string;
    capacity: number;
    tiers: Tier[];
    monthMultipliers: Record<number, number>;
    earlyBirdDays: number | null;
    earlyBirdPercent: number | null;
    lastMinuteDays: number | null;
    lastMinutePercent: number | null;
    minPrice: number | null;
    maxPrice: number | null;
    isActive: boolean;
  } | null;
};

const MONTHS = [
  "Січ",
  "Лют",
  "Бер",
  "Кві",
  "Тра",
  "Чер",
  "Лип",
  "Сер",
  "Вер",
  "Жов",
  "Лис",
  "Гру",
];

type EditorState = {
  capacity: string;
  tiers: Tier[];
  months: string[];
  earlyBirdDays: string;
  earlyBirdPercent: string;
  lastMinuteDays: string;
  lastMinutePercent: string;
  minPrice: string;
  maxPrice: string;
  isActive: boolean;
};

function toEditor(country: TariffCountry): EditorState {
  const grid = country.grid;
  return {
    capacity: String(grid?.capacity ?? 46),
    tiers: grid?.tiers.length
      ? grid.tiers.map((t) => ({ ...t }))
      : [
          { share: 0.5, price: 40 },
          { share: 0.25, price: 60 },
          { share: 0.25, price: 90 },
        ],
    months: MONTHS.map((_, i) =>
      grid?.monthMultipliers?.[i + 1] != null
        ? String(grid.monthMultipliers[i + 1])
        : "1"
    ),
    earlyBirdDays: grid?.earlyBirdDays != null ? String(grid.earlyBirdDays) : "",
    earlyBirdPercent:
      grid?.earlyBirdPercent != null ? String(grid.earlyBirdPercent) : "",
    lastMinuteDays:
      grid?.lastMinuteDays != null ? String(grid.lastMinuteDays) : "",
    lastMinutePercent:
      grid?.lastMinutePercent != null ? String(grid.lastMinutePercent) : "",
    minPrice: grid?.minPrice != null ? String(grid.minPrice) : "",
    maxPrice: grid?.maxPrice != null ? String(grid.maxPrice) : "",
    isActive: grid?.isActive ?? true,
  };
}

export default function TariffGrids({
  countries,
}: {
  countries: TariffCountry[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [state, setState] = useState<EditorState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const openEditor = (country: TariffCountry) => {
    setEditingId(country.id);
    setState(toEditor(country));
    setError(null);
    setMessage(null);
  };

  const save = async () => {
    if (!editingId || !state) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const months: Record<string, number> = {};
      state.months.forEach((value, i) => {
        const mult = Number(value);
        if (Number.isFinite(mult) && mult > 0 && mult !== 1) {
          months[String(i + 1)] = mult;
        }
      });
      const res = await fetch("/api/admin/tariffs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryId: editingId,
          capacity: Number(state.capacity) || 46,
          tiers: state.tiers,
          monthMultipliers: months,
          earlyBirdDays: state.earlyBirdDays ? Number(state.earlyBirdDays) : null,
          earlyBirdPercent: state.earlyBirdPercent
            ? Number(state.earlyBirdPercent)
            : null,
          lastMinuteDays: state.lastMinuteDays
            ? Number(state.lastMinuteDays)
            : null,
          lastMinutePercent: state.lastMinutePercent
            ? Number(state.lastMinutePercent)
            : null,
          minPrice: state.minPrice ? Number(state.minPrice) : null,
          maxPrice: state.maxPrice ? Number(state.maxPrice) : null,
          isActive: state.isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Не вдалося зберегти");
      setMessage("Збережено");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  const shareTotal = state
    ? state.tiers.reduce((sum, t) => sum + (Number(t.share) || 0), 0)
    : 0;

  return (
    <div className="space-y-3">
      {countries.map((country) => {
        const grid = country.grid;
        const open = editingId === country.id && state;
        return (
          <div
            key={country.id}
            className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-slate-900">
                {country.name}
              </span>
              {grid ? (
                <span className="text-xs text-slate-500">
                  {grid.tiers
                    .map((t) => `${Math.round(t.share * 100)}% → €${t.price}`)
                    .join(" · ")}{" "}
                  · місткість {grid.capacity}
                  {Object.keys(grid.monthMultipliers).length
                    ? ` · місяці: ${Object.entries(grid.monthMultipliers)
                        .map(([m, v]) => `${MONTHS[Number(m) - 1]} ×${v}`)
                        .join(", ")}`
                    : ""}
                  {!grid.isActive ? " · вимкнено" : ""}
                </span>
              ) : (
                <span className="text-xs text-slate-400">
                  Сітку не налаштовано — діє фіксована ціна рейсу
                </span>
              )}
              <button
                type="button"
                className={`${btnGhost} ml-auto`}
                onClick={() =>
                  open ? setEditingId(null) : openEditor(country)
                }
              >
                {open ? "Згорнути" : grid ? "Редагувати" : "Налаштувати"}
              </button>
            </div>

            {open ? (
              <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Рівні за часткою місць
                    </p>
                    <span
                      className={`text-xs ${Math.abs(shareTotal - 1) > 0.001 ? "text-rose-600" : "text-slate-400"}`}
                    >
                      Сума часток: {Math.round(shareTotal * 100)}%
                    </span>
                  </div>
                  <div className="space-y-2">
                    {state.tiers.map((tier, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-16 text-xs text-slate-500">
                          Рівень {i + 1}
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          className={`${inputClass} w-24`}
                          value={Math.round(tier.share * 100)}
                          onChange={(e) =>
                            setState({
                              ...state,
                              tiers: state.tiers.map((t, j) =>
                                j === i
                                  ? { ...t, share: (Number(e.target.value) || 0) / 100 }
                                  : t
                              ),
                            })
                          }
                        />
                        <span className="text-xs text-slate-500">% місць</span>
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          className={`${inputClass} w-24`}
                          value={tier.price}
                          onChange={(e) =>
                            setState({
                              ...state,
                              tiers: state.tiers.map((t, j) =>
                                j === i
                                  ? { ...t, price: Number(e.target.value) || 0 }
                                  : t
                              ),
                            })
                          }
                        />
                        <span className="text-xs text-slate-500">€</span>
                        <button
                          type="button"
                          className="text-xs text-rose-600"
                          onClick={() =>
                            setState({
                              ...state,
                              tiers: state.tiers.filter((_, j) => j !== i),
                            })
                          }
                          disabled={state.tiers.length <= 1}
                        >
                          прибрати
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="text-xs text-brand-700"
                      onClick={() =>
                        setState({
                          ...state,
                          tiers: [...state.tiers, { share: 0.1, price: 100 }],
                        })
                      }
                    >
                      + додати рівень
                    </button>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Сезонні коефіцієнти по місяцях (1 = без змін)
                  </p>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {MONTHS.map((label, i) => (
                      <label key={label} className="block text-center text-xs">
                        <span className="mb-0.5 block text-slate-500">
                          {label}
                        </span>
                        <input
                          type="number"
                          min={0.1}
                          step={0.05}
                          className={`${inputClass} text-center`}
                          value={state.months[i]}
                          onChange={(e) =>
                            setState({
                              ...state,
                              months: state.months.map((m, j) =>
                                j === i ? e.target.value : m
                              ),
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <label className="block text-xs">
                    <span className="mb-1 block font-medium text-slate-600">
                      Early-bird від, днів
                    </span>
                    <input
                      type="number"
                      min={0}
                      className={inputClass}
                      value={state.earlyBirdDays}
                      onChange={(e) =>
                        setState({ ...state, earlyBirdDays: e.target.value })
                      }
                      placeholder="60"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="mb-1 block font-medium text-slate-600">
                      Early-bird знижка, %
                    </span>
                    <input
                      type="number"
                      min={0}
                      className={inputClass}
                      value={state.earlyBirdPercent}
                      onChange={(e) =>
                        setState({ ...state, earlyBirdPercent: e.target.value })
                      }
                      placeholder="25"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="mb-1 block font-medium text-slate-600">
                      Last-minute за, днів
                    </span>
                    <input
                      type="number"
                      min={0}
                      className={inputClass}
                      value={state.lastMinuteDays}
                      onChange={(e) =>
                        setState({ ...state, lastMinuteDays: e.target.value })
                      }
                      placeholder="3"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="mb-1 block font-medium text-slate-600">
                      Last-minute надбавка, %
                    </span>
                    <input
                      type="number"
                      min={0}
                      className={inputClass}
                      value={state.lastMinutePercent}
                      onChange={(e) =>
                        setState({ ...state, lastMinutePercent: e.target.value })
                      }
                      placeholder="15"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="mb-1 block font-medium text-slate-600">
                      Місткість салону
                    </span>
                    <input
                      type="number"
                      min={1}
                      className={inputClass}
                      value={state.capacity}
                      onChange={(e) =>
                        setState({ ...state, capacity: e.target.value })
                      }
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="mb-1 block font-medium text-slate-600">
                      Мін. ціна, €
                    </span>
                    <input
                      type="number"
                      min={0}
                      className={inputClass}
                      value={state.minPrice}
                      onChange={(e) =>
                        setState({ ...state, minPrice: e.target.value })
                      }
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="mb-1 block font-medium text-slate-600">
                      Макс. ціна, €
                    </span>
                    <input
                      type="number"
                      min={0}
                      className={inputClass}
                      value={state.maxPrice}
                      onChange={(e) =>
                        setState({ ...state, maxPrice: e.target.value })
                      }
                    />
                  </label>
                  <label className="flex items-end gap-2 pb-1 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={state.isActive}
                      onChange={(e) =>
                        setState({ ...state, isActive: e.target.checked })
                      }
                    />
                    Сітка активна
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={save}
                    disabled={busy}
                  >
                    {busy ? "Збереження…" : "Зберегти сітку"}
                  </button>
                  {message ? (
                    <span className="text-sm text-emerald-700">{message}</span>
                  ) : null}
                  {error ? (
                    <span className="text-sm text-rose-700">{error}</span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
