"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  ticketId: string;
  /** RESERVED -> plain cancel, no money. PAID_CASH/PAID_ONLINE -> refund. */
  status: "RESERVED" | "PAID_CASH" | "PAID_ONLINE";
};

const CONFIRM_TEXT: Record<Props["status"], string> = {
  RESERVED: "Скасувати це бронювання?",
  PAID_CASH:
    "Скасувати квиток і повернути кошти готівкою? Частина суми буде утримана згідно з політикою повернень.",
  PAID_ONLINE:
    "Скасувати квиток і оформити повернення онлайн? Частина суми може бути утримана згідно з політикою повернень.",
};

const BUTTON_LABEL: Record<Props["status"], string> = {
  RESERVED: "Скасувати",
  PAID_CASH: "Повернути кошти",
  PAID_ONLINE: "Повернути кошти",
};

export default function CancelTicketButton({ ticketId, status }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    refundAmount: number | null;
    refundWithheld: number | null;
  } | null>(null);

  const handleClick = async () => {
    if (!window.confirm(CONFIRM_TEXT[status])) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Не вдалося скасувати");
      setResult({ refundAmount: data.refundAmount, refundWithheld: data.refundWithheld });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <span className="text-xs text-emerald-700">
        {result.refundAmount != null
          ? `Повернено €${result.refundAmount.toFixed(2)} (утримано €${result.refundWithheld?.toFixed(2)})`
          : "Скасовано"}
      </span>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        className="rounded border border-rose-300 bg-white px-2 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
      >
        {submitting ? "…" : BUTTON_LABEL[status]}
      </button>
      {error ? <p className="mt-1 text-[11px] text-rose-600">{error}</p> : null}
    </div>
  );
}
