"use client";

import { useState } from "react";
import Icon from "@/components/site/Icon";
import { fmt, useI18n } from "@/lib/i18n/client";

type MailState = "idle" | "sending" | "sent" | "off" | "none" | "limit" | "error";

/** «Завантажити PDF» and «Надіслати на e-mail» for the whole order. */
export default function TicketActions({
  reference,
  email,
  mailOn,
}: {
  reference: string;
  email: string | null;
  mailOn: boolean;
}) {
  const { t } = useI18n();
  const tt = t.ticket;
  const [state, setState] = useState<MailState>(!email ? "none" : mailOn ? "idle" : "off");
  const [sentTo, setSentTo] = useState(email ?? "");
  const ref = encodeURIComponent(reference);

  const send = async () => {
    setState("sending");
    try {
      const res = await fetch(`/api/tickets/${ref}/email`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { to?: string };
      if (res.ok) {
        if (data.to) setSentTo(data.to);
        setState("sent");
      } else setState(res.status === 503 ? "off" : res.status === 409 ? "none" : res.status === 429 ? "limit" : "error");
    } catch {
      setState("error");
    }
  };

  const note: Record<MailState, { text: string; tone: string } | null> = {
    idle: null,
    sending: null,
    sent: { text: fmt(tt.emailSent, { email: sentTo }), tone: "text-ok-700" },
    off: { text: tt.emailOff, tone: "text-ink-muted" },
    none: { text: tt.emailNone, tone: "text-ink-muted" },
    limit: { text: tt.emailLimit, tone: "text-warn-700" },
    error: { text: tt.emailError, tone: "text-rose-700" },
  };
  const msg = note[state];
  const canSend = state === "idle" || state === "error";

  return (
    <div className="space-y-2">
      <a href={`/api/tickets/${ref}/pdf?all=1`} download className="btn-primary w-full py-3 text-sm">
        <Icon name="download" className="h-4 w-4" />
        {tt.pdf}
      </a>
      <button
        type="button"
        onClick={send}
        disabled={!canSend}
        className="btn-secondary w-full py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Icon name={state === "sent" ? "check" : "mail"} className="h-4 w-4" />
        {state === "sending" ? tt.emailSending : tt.email}
      </button>
      <p role="status" aria-live="polite" className={`min-h-[1.25rem] text-center text-sm ${msg?.tone ?? ""}`}>
        {msg?.text ?? ""}
      </p>
    </div>
  );
}
