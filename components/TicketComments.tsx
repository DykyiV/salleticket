"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type CommentItem = {
  id: string;
  text: string;
  authorEmail: string;
  createdAt: string | Date;
};

/**
 * Comments thread on a ticket detail page. Adding requires the edit
 * permission (enforced by the API); the parent decides whether to show the
 * form via `canComment`.
 */
export default function TicketComments({
  ticketId,
  comments,
  canComment,
}: {
  ticketId: string;
  comments: CommentItem[];
  canComment: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? `Failed (${res.status})`);
        return;
      }
      setText("");
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {comments.length === 0 ? (
        <p className="text-sm text-slate-400">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
              <p className="whitespace-pre-wrap text-sm text-slate-800">{c.text}</p>
              <p className="mt-1 text-xs text-slate-400">
                {c.authorEmail} ·{" "}
                {new Date(c.createdAt).toISOString().slice(0, 16).replace("T", " ")}
              </p>
            </li>
          ))}
        </ul>
      )}

      {canComment ? (
        <div className="mt-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Додати коментар…"
            className="w-full rounded-xl border-0 px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-500"
          />
          {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
          <button
            type="button"
            onClick={add}
            disabled={busy || text.trim().length === 0}
            className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add comment"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
