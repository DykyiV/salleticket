"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TicketStatus } from "@prisma/client";

type Props = {
  ticketId: string;
  reference: string;
  status: TicketStatus;
  /** Staff may take cash at the desk. */
  canCash: boolean;
  canCancel: boolean;
  canRefund: boolean;
  canPayOnline: boolean;
  /** Hours to pay online before the booking is cancelled. */
  deadlineHours: number;
};

type Step = null | "online" | "cash" | "cancel" | "refund";

const btn =
  "inline-flex h-9 items-center justify-center rounded-xl px-3 text-sm font-semibold transition disabled:opacity-50";

/**
 * Money actions of a ticket. The status itself is never picked by hand: it
 * follows from these actions (and from the payment system).
 *   unpaid → pay online (starts the countdown) · take cash · cancel booking
 *   paid   → refund
 */
export default function TicketPaymentActions(props: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unpaid = props.status === "RESERVED" || props.status === "AWAITING_PAYMENT";
  const paid = props.status === "PAID_ONLINE" || props.status === "PAID_CASH";

  const setStatus = async (status: TicketStatus, extra: Record<string, string> = {}) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/account/tickets/${props.ticketId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Не вдалося виконати дію");
      setStep(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  const startOnline = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/payments/${props.reference}/start`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Не вдалося почати оплату");
      router.push(data.payUrl ?? `/pay/${props.reference}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
      setBusy(false);
    }
  };

  const showOnline = props.status === "RESERVED" && props.canPayOnline;
  const showCash = unpaid && props.canCash;
  const showCancel = unpaid && props.canCancel;
  const showRefund = paid && props.canRefund;
  if (!showOnline && !showCash && !showCancel && !showRefund) return null;

  return (
    <div className="space-y-2">
      {step === null ? (
        <div className="flex flex-wrap gap-2">
          {showOnline ? (
            <button
              type="button"
              onClick={() => setStep("online")}
              className={`${btn} bg-brand-600 text-white hover:bg-brand-700`}
            >
              Оплатити онлайн
            </button>
          ) : null}
          {showCash ? (
            <button
              type="button"
              onClick={() => setStep("cash")}
              className={`${btn} border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100`}
            >
              Прийняти готівку
            </button>
          ) : null}
          {showCancel ? (
            <button
              type="button"
              onClick={() => setStep("cancel")}
              className={`${btn} text-rose-700 hover:bg-rose-50`}
            >
              Скасувати бронювання
            </button>
          ) : null}
          {showRefund ? (
            <button
              type="button"
              onClick={() => setStep("refund")}
              className={`${btn} text-slate-600 hover:bg-slate-100`}
            >
              Оформити повернення
            </button>
          ) : null}
        </div>
      ) : null}

      {step === "online" ? (
        <Confirm
          text={`Після натискання у вас буде ${props.deadlineHours} год на оплату (з онлайн-знижкою). Якщо оплата не надійде вчасно, бронювання автоматично скасується, а ми повідомимо вас SMS та e-mail.`}
          confirmLabel="Перейти до оплати"
          busy={busy}
          onConfirm={startOnline}
          onBack={() => setStep(null)}
        />
      ) : null}
      {step === "cash" ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
          <p className="text-sm text-sky-900">Хто отримав готівку?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setStatus("PAID_CASH", { cashCollector: "ME" })}
              className={`${btn} bg-white text-sky-900 ring-1 ring-sky-300 hover:bg-sky-100`}
            >
              Готівку отримав я
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setStatus("PAID_CASH", { cashCollector: "CARRIER" })}
              className={`${btn} bg-white text-sky-900 ring-1 ring-sky-300 hover:bg-sky-100`}
            >
              Готівка водію в автобусі
            </button>
            <button type="button" onClick={() => setStep(null)} className={`${btn} text-slate-500`}>
              Назад
            </button>
          </div>
        </div>
      ) : null}
      {step === "cancel" ? (
        <Confirm
          text="Скасувати бронювання? Місце звільниться."
          confirmLabel="Так, скасувати"
          tone="danger"
          busy={busy}
          onConfirm={() => setStatus("CANCELLED")}
          onBack={() => setStep(null)}
        />
      ) : null}
      {step === "refund" ? (
        <Confirm
          text="Оформити повернення коштів за оплачений квиток? Квиток стане «Повернено», місце звільниться."
          confirmLabel="Так, повернути кошти"
          tone="danger"
          busy={busy}
          onConfirm={() => setStatus("REFUNDED")}
          onBack={() => setStep(null)}
        />
      ) : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}

function Confirm({
  text,
  confirmLabel,
  onConfirm,
  onBack,
  busy,
  tone = "primary",
}: {
  text: string;
  confirmLabel: string;
  onConfirm: () => void;
  onBack: () => void;
  busy: boolean;
  tone?: "primary" | "danger";
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        tone === "danger" ? "border-rose-200 bg-rose-50" : "border-brand-200 bg-brand-50"
      }`}
    >
      <p className="text-sm text-slate-800">{text}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className={`${btn} ${
            tone === "danger" ? "bg-rose-600 text-white hover:bg-rose-700" : "bg-brand-600 text-white hover:bg-brand-700"
          }`}
        >
          {busy ? "…" : confirmLabel}
        </button>
        <button type="button" onClick={onBack} className={`${btn} text-slate-500`}>
          Назад
        </button>
      </div>
    </div>
  );
}
