"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const TRANSITIONS: Record<string, { status: string; label: string; style: string }[]> = {
  RESERVED: [
    {
      status: "PAID_ONLINE",
      label: "Mark paid online",
      style: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100",
    },
    {
      status: "PAID_CASH",
      label: "Mark paid cash (to carrier)",
      style: "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100",
    },
    {
      status: "CANCELLED",
      label: "Cancel ticket",
      style: "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100",
    },
  ],
  PAID_ONLINE: [
    {
      status: "REFUNDED",
      label: "Refund",
      style: "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100",
    },
    {
      status: "CANCELLED",
      label: "Cancel ticket",
      style: "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100",
    },
  ],
  PAID_CASH: [
    {
      status: "REFUNDED",
      label: "Refund",
      style: "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100",
    },
    {
      status: "CANCELLED",
      label: "Cancel ticket",
      style: "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100",
    },
  ],
  CANCELLED: [],
  REFUNDED: [],
};

/**
 * Status transition buttons for the admin ticket detail page. Every change
 * goes through PATCH /api/admin/tickets/[id] and is recorded in the ticket
 * history with the admin as actor.
 */
export default function TicketStatusControl({
  ticketId,
  currentStatus,
}: {
  ticketId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const actions = TRANSITIONS[currentStatus] ?? [];

  const change = async (status: string) => {
    setLoading(status);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? `Failed with status ${res.status}`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(null);
    }
  };

  if (actions.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        Terminal status — no further transitions possible.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.status}
            type="button"
            onClick={() => change(a.status)}
            disabled={loading !== null}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${a.style}`}
          >
            {loading === a.status ? "…" : a.label}
          </button>
        ))}
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
