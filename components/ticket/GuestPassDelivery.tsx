"use client";

import { useState } from "react";

export default function GuestPassDelivery({
  references,
  email,
  payUrl,
}: {
  references: string[];
  email: string;
  payUrl?: string;
}) {
  const [address, setAddress] = useState(email);
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/tickets/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ references, email: address.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Не вдалося надіслати");
      setSummary(typeof data.summary === "string" ? data.summary : null);
      setMessage(data.message ?? "Готово");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не вдалося надіслати");
    } finally {
      setBusy(false);
    }
  };

  const mailto =
    summary && address
      ? `mailto:${encodeURIComponent(address)}?subject=${encodeURIComponent("Посадковий талон")}&body=${encodeURIComponent(summary)}`
      : null;
  const cabinetHref = `/login?next=${encodeURIComponent(payUrl || "/cabinet/tickets")}&booked=1`;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        {references.map((ref) => (
          <a
            key={ref}
            href={`/api/tickets/${ref}/pdf`}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Завантажити {ref}
          </a>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 p-3">
        <p className="text-sm font-medium text-slate-900">Надіслати на пошту без реєстрації</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="you@example.com"
            className="h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm"
          />
          <button
            type="button"
            onClick={send}
            disabled={busy}
            className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-brand-300 disabled:opacity-60"
          >
            {busy ? "Надсилаю…" : "Надіслати"}
          </button>
        </div>
        {message ? <p className="mt-2 text-sm text-slate-600">{message}</p> : null}
        {mailto ? (
          <a href={mailto} className="mt-1 inline-block text-sm font-medium text-brand-700 underline">
            Відкрити лист у своїй пошті
          </a>
        ) : null}
      </div>

      <a href={cabinetHref} className="inline-flex text-sm font-medium text-brand-700 hover:underline">
        {payUrl ? "Увійти й оплатити в кабінеті" : "Усе ж зберегти талон у кабінеті"}
      </a>
    </div>
  );
}
