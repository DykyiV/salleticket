"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type BulkTicketRow = {
  id: string;
  reference: string;
  passenger: string;
  /** Departure variant: age category + promo. */
  type?: string;
  route?: string;
  carrier?: string;
  bookedBy: string;
  price: string;
  status: string;
  created: string;
};

const STATUS_STYLES: Record<string, string> = {
  RESERVED: "bg-amber-50 text-amber-700 ring-amber-200",
  PAID_ONLINE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PAID_CASH: "bg-sky-50 text-sky-700 ring-sky-200",
  CANCELLED: "bg-rose-50 text-rose-700 ring-rose-200",
  REFUNDED: "bg-slate-100 text-slate-600 ring-slate-200",
};

/**
 * Admin tickets table with row selection and bulk actions:
 *   - Print selected → opens one PDF with a page per selected ticket
 *   - Send SMS → sends the same message to all selected passengers
 * Variant "tickets" shows route/carrier/created columns; variant "departure"
 * shows ticket type and a details link instead.
 */
export default function TicketsBulkTable({
  rows,
  variant,
  emptyText,
}: {
  rows: BulkTicketRow[];
  variant: "tickets" | "departure";
  emptyText: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [smsOpen, setSmsOpen] = useState(false);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const selectedIds = useMemo(() => [...selected], [selected]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function printSelected() {
    const ids = selectedIds.join(",");
    window.open(`/api/admin/tickets/pdf?ids=${encodeURIComponent(ids)}`, "_blank");
  }

  const colCount = variant === "tickets" ? 9 : 8;

  return (
    <div>
      {selected.size > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-brand-50 px-4 py-2.5 ring-1 ring-brand-100">
          <span className="text-sm font-medium text-brand-900">
            Selected: {selected.size}
          </span>
          <button
            type="button"
            onClick={printSelected}
            className="rounded-lg bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700"
          >
            🖨 Print PDF
          </button>
          <button
            type="button"
            onClick={() => setSmsOpen(true)}
            className="rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-100"
          >
            ✉ Send SMS
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            Clear
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all"
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
              </th>
              <Th>Reference</Th>
              <Th>Passenger</Th>
              {variant === "tickets" ? (
                <>
                  <Th>Route</Th>
                  <Th>Carrier</Th>
                </>
              ) : (
                <Th>Type</Th>
              )}
              <Th>Booked by</Th>
              <Th className="text-right">Price</Th>
              <Th>Status</Th>
              {variant === "tickets" ? <Th>Created</Th> : <Th />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-10 text-center text-sm text-slate-500">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className={`transition hover:bg-slate-50 ${
                    selected.has(r.id) ? "bg-brand-50/60" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      aria-label={`Select ${r.reference}`}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/tickets/${r.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {r.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <Link
                      href={`/admin/tickets/${r.id}`}
                      className="hover:text-brand-700 hover:underline"
                    >
                      {r.passenger}
                    </Link>
                  </td>
                  {variant === "tickets" ? (
                    <>
                      <td className="px-4 py-3 text-slate-700">{r.route}</td>
                      <td className="px-4 py-3 text-slate-700">{r.carrier}</td>
                    </>
                  ) : (
                    <td className="px-4 py-3 text-slate-600">{r.type}</td>
                  )}
                  <td className="px-4 py-3 text-slate-500">{r.bookedBy}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                    {r.price}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                        STATUS_STYLES[r.status] ?? "bg-slate-100 text-slate-600 ring-slate-200"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  {variant === "tickets" ? (
                    <td className="px-4 py-3 tabular-nums text-slate-500">{r.created}</td>
                  ) : (
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/tickets/${r.id}`}
                        className="text-xs font-medium text-brand-700 hover:underline"
                      >
                        Details →
                      </Link>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {smsOpen ? (
        <SmsModal
          ticketIds={selectedIds}
          count={selected.size}
          onClose={(sent) => {
            setSmsOpen(false);
            if (sent) setSelected(new Set());
          }}
        />
      ) : null}
    </div>
  );
}

function SmsModal({
  ticketIds,
  count,
  onClose,
}: {
  ticketIds: string[];
  count: number;
  onClose: (sent: boolean) => void;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketIds, message: message.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? `Send failed (${res.status})`);
        return;
      }
      setSummary(`Sent: ${body.sent}, failed: ${body.failed}`);
      setTimeout(() => onClose(true), 1500);
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-slate-900">
          SMS to {count} passenger{count === 1 ? "" : "s"}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          The same message goes to the passenger phone of every selected
          ticket. Each send is recorded in the ticket history.
        </p>
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
        {summary ? (
          <p className="mt-2 text-xs font-medium text-emerald-600">{summary}</p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onClose(false)}
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
  );
}

function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${className}`}
    >
      {children}
    </th>
  );
}
