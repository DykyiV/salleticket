"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  kind: "CARRIER" | "AGENT";
  counterpartyId: string;
  name: string;
  /** Open balance: positive — we owe them, negative — they owe us. */
  debt: number;
};

const LABELS = {
  CARRIER: { OUTGOING: "Ми сплатили перевізнику", INCOMING: "Перевізник сплатив нам" },
  AGENT: { OUTGOING: "Ми виплатили агенту (винагорода)", INCOMING: "Агент здав нам готівку" },
} as const;

const today = () => new Date().toISOString().slice(0, 10);

/** "+ Платіж" button with a small dialog to record money transferred. */
export default function PaymentDialog({ kind, counterpartyId, name, debt }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"OUTGOING" | "INCOMING">("OUTGOING");
  const [paidAt, setPaidAt] = useState(today);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const show = () => {
    // Prefill with the open balance, in the direction that closes it.
    setAmount(Math.abs(debt) >= 0.01 ? Math.abs(debt).toFixed(2) : "");
    setDirection(debt < 0 ? "INCOMING" : "OUTGOING");
    setPaidAt(today());
    setNote("");
    setError(null);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/finance/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, counterpartyId, direction, amount: Number(amount.replace(",", ".")), paidAt, note }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? `Помилка (${res.status})`);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Помилка мережі");
    } finally {
      setSaving(false);
    }
  };

  const input =
    "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200";

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="inline-flex h-8 items-center whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
      >
        + Платіж
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Платіж: ${name}`}
            className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 text-left shadow-xl"
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Внести платіж</h2>
              <p className="text-sm text-slate-500">{name}</p>
            </div>
            <fieldset className="space-y-2">
              {(["OUTGOING", "INCOMING"] as const).map((d) => (
                <label key={d} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="radio" name="direction" checked={direction === d} onChange={() => setDirection(d)} />
                  {LABELS[kind][d]}
                </label>
              ))}
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Сума, EUR</span>
                <input
                  className={input}
                  inputMode="decimal"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-label="Сума, EUR"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Дата</span>
                <input className={input} type="date" required value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Коментар</span>
              <input
                className={input}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="№ платіжки, рахунок…"
                maxLength={500}
              />
            </label>
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Скасувати
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? "Зберігаю…" : "Зберегти платіж"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

/** Remove a payment entered by mistake. */
export function DeletePaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/finance/payments/${paymentId}`, { method: "DELETE" });
    setBusy(false);
    setArmed(false);
    if (res.ok) router.refresh();
  };

  return (
    <button
      type="button"
      onClick={remove}
      onBlur={() => setArmed(false)}
      disabled={busy}
      className={`text-xs font-medium ${armed ? "text-rose-700" : "text-slate-400 hover:text-rose-600"}`}
    >
      {armed ? "Точно видалити?" : "Видалити"}
    </button>
  );
}
