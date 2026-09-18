"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { btnPrimary } from "@/components/admin/Field";

type GroupItem = {
  reference: string;
  passenger: string;
  ticketStatus: string;
  payment: {
    status: string;
    amount: number;
    fullAmount: number;
    sentAt: string | null;
    settleAfter: string | null;
    deadlineAt: string;
  } | null;
};

type GroupState = {
  groupRef: string;
  items: GroupItem[];
  total: number;
  allSettled: boolean;
  anyWaiting: boolean;
  anyPending: boolean;
};

export default function PaymentPanel({
  reference,
  settleMinutes,
}: {
  reference: string;
  settleMinutes: number;
}) {
  const router = useRouter();
  const [state, setState] = useState<GroupState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const refresh = async () => {
    try {
      const res = await fetch(`/api/payments/${reference}/status`);
      const data = await res.json();
      if (res.ok) setState(data);
    } catch {
      // keep polling
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  useEffect(() => {
    if (!state || state.allSettled) return;
    const timer = window.setInterval(() => {
      void refresh();
    }, 5000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference, state?.allSettled]);

  const deadline = state?.items.find((i) => i.payment)?.payment?.deadlineAt;
  const deadlineMs = deadline ? new Date(deadline).getTime() - now : null;
  const deadlinePassed = deadlineMs != null && deadlineMs <= 0;

  const settleAt = state?.items.find((i) => i.payment?.settleAfter)?.payment
    ?.settleAfter;
  const settleMs = settleAt ? new Date(settleAt).getTime() - now : null;

  // When the discount deadline runs out, reconcile once so the ticket drops
  // back to full price and the panel repaints.
  useEffect(() => {
    if (!deadlinePassed || !state?.anyPending) return;
    const t = window.setTimeout(() => void refresh(), 800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlinePassed, state?.anyPending]);

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/payments/${reference}/pay`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Не вдалося сплатити");
      await refresh();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка оплати");
    } finally {
      setBusy(false);
    }
  };

  if (!state) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        Завантаження оплати…
      </div>
    );
  }

  if (state.allSettled) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-lg font-semibold text-emerald-800">
          Оплату зараховано
        </p>
        <p className="mt-1 text-sm text-emerald-700">
          {state.items.length > 1
            ? `Квитки ${state.items.map((i) => i.reference).join(", ")} оплачено онлайн.`
            : `Квиток ${state.items[0]?.reference ?? reference} оплачено онлайн.`}
        </p>
        <a
          href={`/cabinet/tickets/${state.items[0]?.reference ?? reference}`}
          className="mt-4 inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Відкрити квиток
        </a>
      </div>
    );
  }

  if (deadlinePassed && state.anyPending === false && !state.allSettled) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-lg font-semibold text-amber-800">Час вийшов</p>
        <p className="mt-1 text-sm text-amber-700">
          24 години на онлайн-оплату минули — знижка згоріла. Квиток у резерві
          за повною ціною, оплата в автобусі.
        </p>
        <a
          href={`/cabinet/tickets/${state.items[0]?.reference ?? reference}`}
          className="mt-4 inline-block rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          До квитка
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Оплата {state.items.length > 1 ? `групи ${state.groupRef}` : `квитка ${reference}`}
      </p>

      <ul className="mt-3 divide-y divide-slate-100 text-sm">
        {state.items.map((item) => (
          <li key={item.reference} className="flex items-center justify-between py-2">
            <span className="text-slate-700">
              {item.passenger}
              <span className="ml-2 text-xs text-slate-400">{item.reference}</span>
            </span>
            <span className="tabular-nums text-slate-900">
              €{(item.payment?.amount ?? 0).toFixed(2)}
              {item.payment && item.payment.fullAmount > item.payment.amount ? (
                <span className="ml-1 text-xs text-slate-400 line-through">
                  €{item.payment.fullAmount.toFixed(2)}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-lg font-bold tabular-nums text-slate-900">
        <span>Разом</span>
        <span>€{state.total.toFixed(2)}</span>
      </p>

      {deadline && !deadlinePassed ? (
        <p className="mt-1 text-sm text-slate-500">
          До кінця знижки:{" "}
          <span className="font-semibold tabular-nums text-slate-900">
            {formatCountdown(deadlineMs ?? 0)}
          </span>{" "}
          <span className="text-xs text-slate-400">
            (до {new Date(deadline).toLocaleString("uk-UA")})
          </span>{" "}
          — інакше знижка за онлайн-оплату згорить.
        </p>
      ) : null}

      {state.anyWaiting ? (
        <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-violet-800">
            <Spinner className="h-4 w-4" />
            Очікуємо зарахування коштів…
            {settleMs != null && settleMs > 0 ? (
              <span className="ml-1 tabular-nums">
                ~{formatCountdown(settleMs)}
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-xs text-violet-700">
            Платіжна система зазвичай підтверджує переказ за {settleMinutes}{" "}
            хв. Сторінка оновиться автоматично, статус квитка — «очікує
            зарахування коштів».
          </p>
        </div>
      ) : null}

      {state.anyPending ? (
        <button
          type="button"
          onClick={pay}
          disabled={busy}
          className={`${btnPrimary} mt-5 w-full`}
        >
          {busy ? "Надсилаємо…" : `Сплатити €${state.total.toFixed(2)}`}
        </button>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
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
