"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

type PaymentMethod = "ONLINE" | "CASH_TO_AGENT" | "CASH_TO_CARRIER";

const LABELS: Record<PaymentMethod, string> = {
  ONLINE: "Онлайн",
  CASH_TO_AGENT: "Готівка агенту",
  CASH_TO_CARRIER: "Готівка перевізнику",
};

export default function PaymentMethodCell({
  ticketId,
  value,
  readOnly = false,
}: {
  ticketId: string;
  value: PaymentMethod | null;
  /** True when the viewer (an AGENT without canMarkPayments) may see but not change this. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<PaymentMethod | "">(value ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as PaymentMethod;
    const prev = current;
    setCurrent(next);
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/staff/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Не вдалося оновити");
      }
      router.refresh();
    } catch (err) {
      setCurrent(prev);
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setSaving(false);
    }
  };

  if (readOnly) {
    return (
      <span className="text-xs text-slate-500">
        {current ? LABELS[current] : "Не позначено"}
      </span>
    );
  }

  return (
    <div>
      <select
        value={current}
        onChange={handleChange}
        disabled={saving}
        className="h-8 rounded border border-slate-300 bg-white px-1.5 text-xs disabled:opacity-60"
      >
        <option value="" disabled>
          Не позначено
        </option>
        {(Object.keys(LABELS) as PaymentMethod[]).map((pm) => (
          <option key={pm} value={pm}>
            {LABELS[pm]}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-[11px] text-rose-600">{error}</p> : null}
    </div>
  );
}
