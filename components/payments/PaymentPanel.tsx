"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { btnPrimary } from "@/components/admin/Field";

type PaymentState = {
  ticketStatus: string;
  finalPrice: number;
  payment: {
    status: string;
    amount: number;
    fullAmount: number;
    sentAt: string | null;
    settleAfter: string | null;
    deadlineAt: string;
  } | null;
};

export default function PaymentPanel({
  reference,
  initial,
  settleMinutes,
}: {
  reference: string;
  initial: PaymentState;
  settleMinutes: number;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payment = state.payment;
  const waiting =
    state.ticketStatus === "AWAITING_PAYMENT" && payment?.status === "SENT";
  const canPay =
    state.ticketStatus === "AWAITING_PAYMENT" && payment?.status === "PENDING";

  useEffect(() => {
    if (state.ticketStatus !== "AWAITING_PAYMENT") return;
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/${reference}/status`);
        const data = await res.json();
        if (res.ok) {
          setState(data);
          if (data.ticketStatus !== "AWAITING_PAYMENT") {
            window.clearInterval(timer);
            router.refresh();
          }
        }
      } catch {
        // keep polling
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [reference, state.ticketStatus, router]);

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/payments/${reference}/pay`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Не вдалося сплатити");
      const status = await fetch(`/api/payments/${reference}/status`);
      if (status.ok) setState(await status.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка оплати");
    } finally {
      setBusy(false);
    }
  };

  if (state.ticketStatus === "PAID_ONLINE") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-lg font-semibold text-emerald-800">
          Оплату зараховано
        </p>
        <p className="mt-1 text-sm text-emerald-700">
          Квиток {reference} оплачено онлайн.
        </p>
        <a
          href={`/cabinet/tickets/${reference}`}
          className="mt-4 inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Відкрити квиток
        </a>
      </div>
    );
  }

  if (!payment || state.ticketStatus !== "AWAITING_PAYMENT") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
        <p>Для цього квитка немає активної онлайн-оплати.</p>
        <a
          href={`/cabinet/tickets/${reference}`}
          className="mt-3 inline-block text-brand-700 underline"
        >
          До квитка
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Оплата квитка {reference}
      </p>
      <p className="mt-2 text-3xl font-extrabold tabular-nums text-slate-900">
        €{payment.amount.toFixed(2)}
        {payment.fullAmount > payment.amount ? (
          <span className="ml-2 align-middle text-base font-medium text-slate-400 line-through">
            €{payment.fullAmount.toFixed(2)}
          </span>
        ) : null}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        Оплатіть до{" "}
        <span className="font-medium text-slate-700">
          {new Date(payment.deadlineAt).toLocaleString("uk-UA")}
        </span>{" "}
        — інакше знижка за онлайн-оплату згорить.
      </p>

      {waiting ? (
        <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-violet-800">
            <Spinner className="h-4 w-4" />
            Очікуємо зарахування коштів…
          </p>
          <p className="mt-1 text-xs text-violet-700">
            Платіжна система зазвичай підтверджує переказ за {settleMinutes}{" "}
            хв. Сторінка оновиться автоматично, статус квитка — «очікує
            зарахування коштів».
          </p>
        </div>
      ) : null}

      {canPay ? (
        <button
          type="button"
          onClick={pay}
          disabled={busy}
          className={`${btnPrimary} mt-5 w-full`}
        >
          {busy ? "Надсилаємо…" : `Сплатити €${payment.amount.toFixed(2)}`}
        </button>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className ?? ""}`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  );
}
