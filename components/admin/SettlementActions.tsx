"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Actions for the settlements admin page: generate settlements for the
 * selected period and mark individual settlements as sent.
 */
export function GenerateSettlementsButton({ period }: { period: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      const data = (await res.json()) as { count?: number; error?: string };
      if (!res.ok) {
        setMessage(data.error ?? `Failed with status ${res.status}`);
      } else {
        setMessage(
          data.count
            ? `Generated ${data.count} settlement(s) for ${period}.`
            : `Nothing to settle for ${period} — all sales already invoiced.`
        );
        router.refresh();
      }
    } catch {
      setMessage("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
      >
        {loading ? "Generating…" : `Generate settlements for ${period}`}
      </button>
      {message ? <p className="text-xs text-slate-500">{message}</p> : null}
    </div>
  );
}

export function MarkSentButton({ settlementId }: { settlementId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    setLoading(true);
    try {
      await fetch(`/api/admin/settlements/${settlementId}/send`, {
        method: "POST",
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSend}
      disabled={loading}
      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
    >
      {loading ? "…" : "Mark sent"}
    </button>
  );
}

export function MarkPaidButton({ settlementId }: { settlementId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    setLoading(true);
    try {
      await fetch(`/api/admin/settlements/${settlementId}/pay`, {
        method: "POST",
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handlePay}
      disabled={loading}
      className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:opacity-50"
    >
      {loading ? "…" : "Mark paid"}
    </button>
  );
}
