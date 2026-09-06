"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function RefundPolicyForm({
  initialCashPercent,
  initialOnlinePercent,
}: {
  initialCashPercent: number;
  initialOnlinePercent: number;
}) {
  const router = useRouter();
  const [cashPercent, setCashPercent] = useState(String(Math.round(initialCashPercent * 100)));
  const [onlinePercent, setOnlinePercent] = useState(
    String(Math.round(initialOnlinePercent * 100))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const cash = Number.parseFloat(cashPercent);
      const online = Number.parseFloat(onlinePercent);
      if (!Number.isFinite(cash) || cash < 0 || cash > 100) {
        throw new Error("Відсоток готівкового повернення має бути 0–100");
      }
      if (!Number.isFinite(online) || online < 0 || online > 100) {
        throw new Error("Відсоток онлайн-повернення має бути 0–100");
      }
      const res = await fetch("/api/admin/settings/refund-policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cashRefundPercent: cash / 100,
          onlineRefundPercent: online / 100,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Не вдалося зберегти");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-6"
    >
      <h2 className="text-sm font-semibold text-slate-900">
        Політика повернення коштів
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Скільки від вартості квитка повертається пасажиру при скасуванні вже
        оплаченого квитка. Решта утримується агентом (якщо оплата була йому
        готівкою) або перевізником.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-slate-600">
            Повернення при оплаті готівкою, %
          </span>
          <input
            type="number"
            min="0"
            max="100"
            value={cashPercent}
            onChange={(e) => setCashPercent(e.target.value)}
            className="h-10 w-full rounded border border-slate-300 px-3"
          />
          <span className="mt-1 block text-[11px] text-slate-400">
            Утримання: {100 - (Number.parseFloat(cashPercent) || 0)}%
          </span>
        </label>

        <label className="block text-xs">
          <span className="mb-1 block font-medium text-slate-600">
            Повернення при онлайн-оплаті, %
          </span>
          <input
            type="number"
            min="0"
            max="100"
            value={onlinePercent}
            onChange={(e) => setOnlinePercent(e.target.value)}
            className="h-10 w-full rounded border border-slate-300 px-3"
          />
          <span className="mt-1 block text-[11px] text-slate-400">
            Утримання: {100 - (Number.parseFloat(onlinePercent) || 0)}% (доки
            не підключено реальний платіжний шлюз — тоді сума повернення
            визначатиметься відповіддю від API платіжної системи)
          </span>
        </label>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      {saved ? <p className="mt-3 text-sm text-emerald-700">Збережено.</p> : null}

      <button
        type="submit"
        disabled={saving}
        className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {saving ? "Збереження…" : "Зберегти"}
      </button>
    </form>
  );
}
