"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost, btnPrimary, inputClass } from "@/components/admin/Field";
import {
  defaultCoachLayoutJSON,
  type CoachCellJSON,
  type CoachLayoutJSON,
} from "@/lib/seats";

export type BusRow = {
  id: string;
  plate: string;
  model: string | null;
  decks: number;
  isActive: boolean;
  seatCount: number;
  layout: CoachLayoutJSON;
};

const CELL_CYCLE: CoachCellJSON["t"][] = ["seat", "empty", "wc", "door", "stairs"];
const KIND_CYCLE = ["seat", "semi_sleeper", "sleeper"] as const;
const MULT_CYCLE = [1, 1.2, 1.5];

const CELL_LABEL: Record<CoachCellJSON["t"], string> = {
  seat: "Місце",
  empty: "Пусто",
  wc: "WC",
  door: "Двері",
  stairs: "Сходи",
};

export default function BusesAdmin({ initialBuses }: { initialBuses: BusRow[] }) {
  const router = useRouter();
  const [buses, setBuses] = useState(initialBuses);
  const [editing, setEditing] = useState<BusRow | null>(null);
  const [layout, setLayout] = useState<CoachLayoutJSON | null>(null);
  const [plate, setPlate] = useState("");
  const [model, setModel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openEditor = (bus: BusRow) => {
    setEditing(bus);
    setLayout(JSON.parse(JSON.stringify(bus.layout)) as CoachLayoutJSON);
    setPlate(bus.plate);
    setModel(bus.model ?? "");
    setError(null);
  };

  const seatCount = (l: CoachLayoutJSON) =>
    l.decks.reduce(
      (sum, d) => sum + d.rows.flat().filter((c) => c.t === "seat").length,
      0
    );

  const cycleCell = (deck: number, row: number, col: number) => {
    if (!layout) return;
    const next = JSON.parse(JSON.stringify(layout)) as CoachLayoutJSON;
    const cell = next.decks[deck].rows[row][col];
    const nextType =
      CELL_CYCLE[(CELL_CYCLE.indexOf(cell.t) + 1) % CELL_CYCLE.length];
    next.decks[deck].rows[row][col] =
      nextType === "seat" ? { t: "seat", kind: "seat", mult: 1 } : { t: nextType };
    setLayout(next);
  };

  const cycleKind = (deck: number, row: number, col: number) => {
    if (!layout) return;
    const next = JSON.parse(JSON.stringify(layout)) as CoachLayoutJSON;
    const cell = next.decks[deck].rows[row][col];
    if (cell.t !== "seat") return;
    const kind = KIND_CYCLE[(KIND_CYCLE.indexOf(cell.kind ?? "seat") + 1) % KIND_CYCLE.length];
    cell.kind = kind;
    cell.mult = kind === "sleeper" ? 1.5 : kind === "semi_sleeper" ? 1.2 : 1;
    setLayout(next);
  };

  const cycleMult = (deck: number, row: number, col: number) => {
    if (!layout) return;
    const next = JSON.parse(JSON.stringify(layout)) as CoachLayoutJSON;
    const cell = next.decks[deck].rows[row][col];
    if (cell.t !== "seat") return;
    const current = MULT_CYCLE.indexOf(cell.mult ?? 1);
    cell.mult = MULT_CYCLE[(current + 1) % MULT_CYCLE.length];
    setLayout(next);
  };

  const addRow = (deck: number) => {
    if (!layout) return;
    const next = JSON.parse(JSON.stringify(layout)) as CoachLayoutJSON;
    next.decks[deck].rows.push([{ t: "seat" }, { t: "seat" }, { t: "seat" }, { t: "seat" }]);
    setLayout(next);
  };

  const removeRow = (deck: number) => {
    if (!layout) return;
    const next = JSON.parse(JSON.stringify(layout)) as CoachLayoutJSON;
    if (next.decks[deck].rows.length <= 1) return;
    next.decks[deck].rows.pop();
    setLayout(next);
  };

  const toggleDeck = () => {
    if (!layout) return;
    const next = JSON.parse(JSON.stringify(layout)) as CoachLayoutJSON;
    if (next.decks.length > 1) {
      next.decks.pop();
    } else {
      next.decks.push({
        name: "Верхня палуба",
        rows: defaultCoachLayoutJSON().decks[0].rows.map((r) =>
          r.map((c) => ({ ...c }))
        ),
      });
    }
    setLayout(next);
  };

  const save = async () => {
    if (!editing || !layout) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/buses/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plate, model, layout }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Не вдалося зберегти");
      setEditing(null);
      setLayout(null);
      router.refresh();
      const list = await fetch("/api/admin/buses").then((r) => r.json());
      setBuses(list.buses ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  const createBus = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/buses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plate: "Новий автобус", layout: defaultCoachLayoutJSON() }),
      });
      if (!res.ok) throw new Error("Не вдалося створити");
      const list = await fetch("/api/admin/buses").then((r) => r.json());
      setBuses(list.buses ?? []);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {buses.map((bus) => (
        <div key={bus.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm font-semibold text-slate-900">
              {bus.plate}
            </span>
            <span className="text-xs text-slate-500">
              {bus.model ?? "модель не вказана"} · {bus.seatCount} місць
              {bus.decks > 1 ? " · двоповерховий" : ""}
              {!bus.isActive ? " · вимкнено" : ""}
            </span>
            <button
              type="button"
              className={`${btnGhost} ml-auto`}
              onClick={() => (editing?.id === bus.id ? setEditing(null) : openEditor(bus))}
            >
              {editing?.id === bus.id ? "Згорнути" : "Схема місць"}
            </button>
          </div>

          {editing?.id === bus.id && layout ? (
            <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
              <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                <label className="block text-xs">
                  <span className="mb-1 block font-medium text-slate-600">Номерний знак</span>
                  <input className={inputClass} value={plate} onChange={(e) => setPlate(e.target.value)} />
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block font-medium text-slate-600">Модель</span>
                  <input className={inputClass} value={model} onChange={(e) => setModel(e.target.value)} />
                </label>
              </div>

              <p className="text-xs text-slate-500">
                Клік по комірці — тип (місце → пусто → WC → двері → сходи).
                Кнопки на місці: тип сидіння (звичайне → напівлежаче → спальне) і
                множник ціни (×1 → ×1.2 → ×1.5).
              </p>

              {layout.decks.map((deck, d) => (
                <div key={d} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-700">
                      {deck.name} · {deck.rows.flat().filter((c) => c.t === "seat").length} місць
                    </p>
                    <span className="flex gap-2 text-xs">
                      <button type="button" className="text-brand-700" onClick={() => addRow(d)}>+ ряд</button>
                      <button type="button" className="text-rose-600" onClick={() => removeRow(d)}>− ряд</button>
                    </span>
                  </div>
                  <div className="space-y-1">
                    {deck.rows.map((row, r) => (
                      <div key={r} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0,1fr))` }}>
                        {row.map((cell, c) => (
                          <div key={c} className="relative">
                            <button
                              type="button"
                              onClick={() => cycleCell(d, r, c)}
                              className={`flex h-9 w-full items-center justify-center rounded text-[10px] font-semibold ${
                                cell.t === "seat"
                                  ? cell.kind === "sleeper"
                                    ? "bg-indigo-200 text-indigo-900 ring-1 ring-indigo-400"
                                    : cell.kind === "semi_sleeper"
                                      ? "bg-sky-100 text-sky-900 ring-1 ring-sky-300"
                                      : "bg-white text-slate-700 ring-1 ring-slate-300"
                                  : "bg-slate-200 text-slate-500"
                              }`}
                            >
                              {cell.t === "seat" ? (cell.mult ?? 1) !== 1 ? `×${cell.mult}` : "місце" : CELL_LABEL[cell.t]}
                            </button>
                            {cell.t === "seat" ? (
                              <span className="absolute -top-1.5 right-0 flex gap-0.5">
                                <button
                                  type="button"
                                  title="Тип сидіння"
                                  className="rounded bg-slate-700 px-1 text-[9px] text-white"
                                  onClick={() => cycleKind(d, r, c)}
                                >
                                  {cell.kind === "sleeper" ? "сп" : cell.kind === "semi_sleeper" ? "н/л" : "зв"}
                                </button>
                                <button
                                  type="button"
                                  title="Множник ціни"
                                  className="rounded bg-brand-600 px-1 text-[9px] text-white"
                                  onClick={() => cycleMult(d, r, c)}
                                >
                                  ×
                                </button>
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className={btnGhost} onClick={toggleDeck}>
                  {layout.decks.length > 1 ? "Прибрати верхню палубу" : "Додати верхню палубу"}
                </button>
                <span className="text-xs text-slate-500">
                  Усього місць: {seatCount(layout)}
                </span>
                <button type="button" className={`${btnPrimary} ml-auto`} onClick={save} disabled={busy}>
                  {busy ? "Збереження…" : "Зберегти автобус"}
                </button>
              </div>
              {error ? <p className="text-sm text-rose-700">{error}</p> : null}
            </div>
          ) : null}
        </div>
      ))}

      <button type="button" className={btnGhost} onClick={createBus} disabled={busy}>
        + Додати автобус
      </button>
    </div>
  );
}
