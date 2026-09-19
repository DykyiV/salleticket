"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** SUPER_ADMIN: reprice the ticket at the current tariff grid. */
export default function RecalcPriceButton({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recalc = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/account/tickets/${ticketId}/price-recalc`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Не вдалося перерахувати");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={recalc}
        disabled={busy}
        title="Перерахувати за актуальною тарифною сіткою"
        className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60"
      >
        {busy ? "…" : "Перерахувати ціну"}
      </button>
      {error ? <span className="text-xs text-rose-700">{error}</span> : null}
    </span>
  );
}
