"use client";

import { useState } from "react";

/**
 * SMS icon button for a single ticket (admin). Opens a small modal and sends
 * via the bulk endpoint with one ticket id; the send is recorded in the
 * ticket history as SMS_SENT / SMS_FAILED.
 */
export default function SendSmsButton({
  ticketId,
  passengerName,
}: {
  ticketId: string;
  passengerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketIds: [ticketId], message: message.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? `Send failed (${res.status})`);
        return;
      }
      if (body.failed > 0) {
        setError(body.results?.[0]?.error ?? "Delivery failed");
        return;
      }
      setDone(true);
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setMessage("");
      }, 1200);
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Надіслати SMS пасажиру"
        aria-label="Надіслати SMS пасажиру"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 ring-1 ring-slate-200 transition hover:bg-brand-50 hover:text-brand-700"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              SMS пасажиру {passengerName}
            </h3>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="Текст повідомлення…"
              className="mt-4 w-full rounded-xl border-0 px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-500"
            />
            <p className="mt-1 text-right text-xs text-slate-400">
              {message.length}/500
            </p>
            {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
            {done ? (
              <p className="mt-2 text-xs font-medium text-emerald-600">Надіслано ✓</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 ring-1 ring-slate-300 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={send}
                disabled={busy || message.trim().length === 0}
                className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
