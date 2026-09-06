"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export type DiscountCardRow = {
  id: string;
  code: string;
  percent: number;
  isActive: boolean;
  usedCount: number;
  source: string;
  userEmail: string | null;
  createdAt: string;
};

export default function DiscountCardsAdmin({
  initialCards,
}: {
  initialCards: DiscountCardRow[];
}) {
  const router = useRouter();
  const [cards, setCards] = useState<DiscountCardRow[]>(initialCards);
  const [userEmail, setUserEmail] = useState("");
  const [percent, setPercent] = useState("10");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/discount-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail: userEmail.trim(), percent: percent.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Не вдалося створити картку");
      setCards((list) => [toRow(data.card), ...list]);
      setUserEmail("");
      setPercent("10");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (row: DiscountCardRow) => {
    const next = !row.isActive;
    setCards((list) => list.map((c) => (c.id === row.id ? { ...c, isActive: next } : c)));
    try {
      const res = await fetch(`/api/admin/discount-cards/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      setCards((list) => list.map((c) => (c.id === row.id ? { ...c, isActive: !next } : c)));
      setError("Не вдалося змінити статус");
    }
  };

  const deleteRow = async (row: DiscountCardRow) => {
    if (!window.confirm(`Видалити картку ${row.code}?`)) return;
    const snapshot = cards;
    setCards((list) => list.filter((c) => c.id !== row.id));
    try {
      const res = await fetch(`/api/admin/discount-cards/${row.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
    } catch {
      setCards(snapshot);
      setError("Не вдалося видалити");
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4"
      >
        <label className="block text-xs sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-600">Email клієнта</span>
          <input
            type="email"
            required
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            placeholder="client@example.com"
            className="h-9 w-full rounded border border-slate-300 px-2"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-slate-600">Знижка, %</span>
          <input
            type="number"
            min="1"
            max="99"
            required
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            className="h-9 w-full rounded border border-slate-300 px-2"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={submitting}
            className="h-9 w-full rounded bg-slate-900 px-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitting ? "Створення…" : "Видати картку"}
          </button>
        </div>
      </form>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-4 py-2">Код</th>
              <th className="border-b border-slate-200 px-4 py-2">Клієнт</th>
              <th className="border-b border-slate-200 px-4 py-2">Знижка</th>
              <th className="border-b border-slate-200 px-4 py-2">Джерело</th>
              <th className="border-b border-slate-200 px-4 py-2">Використано</th>
              <th className="border-b border-slate-200 px-4 py-2">Активна</th>
              <th className="border-b border-slate-200 px-4 py-2 text-right">Дії</th>
            </tr>
          </thead>
          <tbody>
            {cards.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={7}>
                  Карток ще немає.
                </td>
              </tr>
            ) : (
              cards.map((row) => (
                <tr key={row.id} className="odd:bg-white even:bg-slate-50">
                  <td className="border-t border-slate-100 px-4 py-2 font-mono">{row.code}</td>
                  <td className="border-t border-slate-100 px-4 py-2">{row.userEmail ?? "—"}</td>
                  <td className="border-t border-slate-100 px-4 py-2 tabular-nums">
                    {Math.round(row.percent * 100)}%
                  </td>
                  <td className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                    {row.source}
                  </td>
                  <td className="border-t border-slate-100 px-4 py-2 tabular-nums">
                    {row.usedCount}
                  </td>
                  <td className="border-t border-slate-100 px-4 py-2">
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
                  <td className="border-t border-slate-100 px-4 py-2 text-right">
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
    </div>
  );
}

type ApiCard = {
  id: string;
  code: string;
  percent: number;
  isActive: boolean;
  usedCount: number;
  source: string;
  createdAt: string;
  user?: { id: string; email: string } | null;
};

function toRow(c: ApiCard): DiscountCardRow {
  return {
    id: c.id,
    code: c.code,
    percent: c.percent,
    isActive: c.isActive,
    usedCount: c.usedCount,
    source: c.source,
    userEmail: c.user?.email ?? null,
    createdAt: c.createdAt,
  };
}
