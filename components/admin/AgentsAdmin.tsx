"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type AgentRow = {
  id: string;
  email: string;
  role: string;
  commissionType: "FIXED" | "PERCENT" | null;
  commissionValue: number | null;
};

function formatCommission(row: AgentRow): string {
  if (!row.commissionType || row.commissionValue == null) return "не задано";
  return row.commissionType === "FIXED"
    ? `€${row.commissionValue.toFixed(2)} / квиток`
    : `${Math.round(row.commissionValue * 100)}%`;
}

export default function AgentsAdmin({ initialAgents }: { initialAgents: AgentRow[] }) {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentRow[]>(initialAgents);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<"FIXED" | "PERCENT">("PERCENT");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startEdit = (row: AgentRow) => {
    setEditingId(row.id);
    setType(row.commissionType ?? "PERCENT");
    setValue(
      row.commissionValue == null
        ? ""
        : row.commissionType === "PERCENT"
          ? String(Math.round(row.commissionValue * 100))
          : String(row.commissionValue)
    );
    setError(null);
  };

  const save = async (userId: string) => {
    setSaving(true);
    setError(null);
    try {
      const numeric = Number.parseFloat(value);
      if (!Number.isFinite(numeric) || numeric < 0) {
        throw new Error("Вкажіть невід'ємне число");
      }
      const commissionValue = type === "PERCENT" ? numeric / 100 : numeric;
      const res = await fetch(`/api/admin/agents/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionType: type, commissionValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Не вдалося зберегти");
      setAgents((list) => list.map((a) => (a.id === userId ? data.user : a)));
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setSaving(false);
    }
  };

  const clear = async (userId: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/agents/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionType: null, commissionValue: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Не вдалося очистити");
      setAgents((list) => list.map((a) => (a.id === userId ? data.user : a)));
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-4 py-2">Агент</th>
              <th className="border-b border-slate-200 px-4 py-2">Роль</th>
              <th className="border-b border-slate-200 px-4 py-2">Комісія</th>
              <th className="border-b border-slate-200 px-4 py-2 text-right">Дії</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((row) => (
              <tr key={row.id} className="odd:bg-white even:bg-slate-50">
                <td className="border-t border-slate-100 px-4 py-2">{row.email}</td>
                <td className="border-t border-slate-100 px-4 py-2">{row.role}</td>
                <td className="border-t border-slate-100 px-4 py-2">
                  {editingId === row.id ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value as "FIXED" | "PERCENT")}
                        className="h-8 rounded border border-slate-300 bg-white px-1.5 text-xs"
                      >
                        <option value="PERCENT">%</option>
                        <option value="FIXED">€ / квиток</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        step={type === "PERCENT" ? "1" : "0.01"}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="h-8 w-20 rounded border border-slate-300 px-2 text-xs"
                      />
                    </div>
                  ) : (
                    formatCommission(row)
                  )}
                </td>
                <td className="border-t border-slate-100 px-4 py-2 text-right">
                  {editingId === row.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => save(row.id)}
                        disabled={saving}
                        className="mr-2 rounded border border-slate-300 bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-60"
                      >
                        Зберегти
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                      >
                        Скасувати
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        className="mr-2 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                      >
                        Редагувати
                      </button>
                      {row.commissionType ? (
                        <button
                          type="button"
                          onClick={() => clear(row.id)}
                          disabled={saving}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-rose-700 disabled:opacity-60"
                        >
                          Прибрати
                        </button>
                      ) : null}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
