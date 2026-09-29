"use client";

import { useEffect, useState } from "react";
import { btnGhost, btnPrimary } from "@/components/admin/Field";

/**
 * Bulk actions for the staff ticket list (/cabinet/tickets): print one PDF
 * with every selected ticket, or send the same SMS to their passengers.
 *
 * The table itself stays server-rendered; each row carries a checkbox with
 * `data-bulk-ticket="<ticketId>"`, and this toolbar reads the selection from
 * the DOM, so the list keeps its existing markup and filters.
 */
const SELECTOR = "input[data-bulk-ticket]";

function selectedIds(): string[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>(SELECTOR))
    .filter((el) => el.checked)
    .map((el) => el.dataset.bulkTicket ?? "")
    .filter(Boolean);
}

export default function TicketBulkActions({ canSms }: { canSms: boolean }) {
  const [count, setCount] = useState(0);
  const [smsOpen, setSmsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onChange = (e: Event) => {
      if ((e.target as Element | null)?.matches?.(SELECTOR)) {
        setCount(selectedIds().length);
      }
    };
    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  }, []);

  const setAll = (checked: boolean) => {
    document
      .querySelectorAll<HTMLInputElement>(SELECTOR)
      .forEach((el) => (el.checked = checked));
    setCount(checked ? selectedIds().length : 0);
  };

  const printPdf = () => {
    const ids = selectedIds();
    if (ids.length === 0) return;
    window.open(
      `/api/tickets/bulk-pdf?ids=${encodeURIComponent(ids.join(","))}`,
      "_blank"
    );
  };

  const sendSms = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketIds: selectedIds(), message: message.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? `Не вдалося надіслати (${res.status})`);
        return;
      }
      setResult(`Надіслано: ${body.sent}, з помилкою: ${body.failed}`);
      setMessage("");
    } catch {
      setError("Помилка мережі — спробуйте ще раз");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-slate-500" aria-live="polite">
        Вибрано: <span className="font-semibold text-slate-900">{count}</span>
      </span>
      <button type="button" className={btnGhost} onClick={() => setAll(true)}>
        Вибрати всі
      </button>
      <button
        type="button"
        className={btnGhost}
        onClick={() => setAll(false)}
        disabled={count === 0}
      >
        Зняти вибір
      </button>
      <button
        type="button"
        className={btnPrimary}
        onClick={printPdf}
        disabled={count === 0}
      >
        Друк PDF ({count})
      </button>
      {canSms ? (
        <button
          type="button"
          className={btnGhost}
          onClick={() => {
            setSmsOpen(true);
            setResult(null);
            setError(null);
          }}
          disabled={count === 0}
        >
          SMS ({count})
        </button>
      ) : null}

      {smsOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-sms-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 id="bulk-sms-title" className="text-base font-semibold text-slate-900">
              SMS для {count} пасажир{count === 1 ? "а" : "ів"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Кожне відправлення фіксується в історії квитка.
            </p>
            <textarea
              className="mt-3 h-28 w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
              maxLength={500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Текст повідомлення (до 500 символів)"
            />
            {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
            {result ? <p className="mt-2 text-xs text-emerald-700">{result}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={btnGhost} onClick={() => setSmsOpen(false)}>
                Закрити
              </button>
              <button
                type="button"
                className={btnPrimary}
                onClick={sendSms}
                disabled={busy || message.trim().length === 0}
              >
                {busy ? "Надсилаю…" : "Надіслати"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
