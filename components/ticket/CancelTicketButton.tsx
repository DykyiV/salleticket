"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btnGhost } from "@/components/admin/Field";

export default function CancelTicketButton({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = async () => {
    if (!window.confirm("Скасувати це бронювання?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/account/tickets/${ticketId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Не вдалося скасувати");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <button type="button" className={btnGhost} disabled={busy} onClick={cancel}>
        {busy ? "Скасування…" : "Скасувати бронювання"}
      </button>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
