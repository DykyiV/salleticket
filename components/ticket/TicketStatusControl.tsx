"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TicketStatus } from "@prisma/client";
import {
  STATUS_ACTION_CLASS,
  STATUS_ACTION_LABEL,
  STATUS_TRANSITIONS,
} from "@/lib/tickets/labels";

export default function TicketStatusControl({
  ticketId,
  currentStatus,
}: {
  ticketId: string;
  currentStatus: TicketStatus;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const actions = STATUS_TRANSITIONS[currentStatus] ?? [];

  const change = async (status: TicketStatus) => {
    setLoading(status);
    setError(null);
    try {
      const res = await fetch(`/api/account/tickets/${ticketId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Не вдалося змінити статус");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setLoading(null);
    }
  };

  if (actions.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Кінцевий статус — подальші зміни недоступні.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {actions.map((status) => (
          <button
            key={status}
            type="button"
            disabled={loading !== null}
            onClick={() => change(status)}
            className={`rounded-xl border px-3 py-2 text-sm font-medium disabled:opacity-50 ${STATUS_ACTION_CLASS[status]}`}
          >
            {loading === status ? "…" : STATUS_ACTION_LABEL[status]}
          </button>
        ))}
      </div>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
