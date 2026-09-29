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

  const change = async (
    status: TicketStatus,
    cashCollector?: "ME" | "CARRIER",
  ) => {
    setLoading(cashCollector ? `${status}:${cashCollector}` : status);
    setError(null);
    try {
      const res = await fetch(`/api/account/tickets/${ticketId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          cashCollector ? { status, cashCollector } : { status },
        ),
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
        {actions.map((status) =>
          status === "PAID_CASH" ? (
            // Cash: say who holds the money — it decides the settlement.
            <span key={status} className="inline-flex flex-wrap gap-2">
              {(
                [
                  ["ME", "Готівку отримав я"],
                  ["CARRIER", "Готівка водію в автобусі"],
                ] as const
              ).map(([who, label]) => (
                <button
                  key={who}
                  type="button"
                  disabled={loading !== null}
                  onClick={() => change(status, who)}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium disabled:opacity-50 ${STATUS_ACTION_CLASS[status]}`}
                >
                  {loading === `${status}:${who}` ? "…" : label}
                </button>
              ))}
            </span>
          ) : (
            <button
              key={status}
              type="button"
              disabled={loading !== null}
              onClick={() => change(status)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium disabled:opacity-50 ${STATUS_ACTION_CLASS[status]}`}
            >
              {loading === status ? "…" : STATUS_ACTION_LABEL[status]}
            </button>
          ),
        )}
      </div>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
