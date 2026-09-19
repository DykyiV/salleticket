"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnPrimary, inputClass } from "@/components/admin/Field";

export type SaleSettingsValues = {
  onlineDiscountPercent: number;
  paymentSettleMinutes: number;
  paymentDeadlineHours: number;
  seatHoldMinutes: number;
};

export default function SaleSettings({
  initial,
}: {
  initial: SaleSettingsValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof SaleSettingsValues) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setValues((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 }));
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Не вдалося зберегти");
      setMessage("Збережено");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-slate-600">
            Знижка за онлайн-оплату, %
          </span>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            className={inputClass}
            value={values.onlineDiscountPercent}
            onChange={set("onlineDiscountPercent")}
          />
          <span className="mt-1 block text-[11px] text-slate-400">
            0 — без знижки. Ціна «оплатити зараз» буде нижчою.
          </span>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-slate-600">
            Годин на онлайн-оплату
          </span>
          <input
            type="number"
            min={1}
            step={1}
            className={inputClass}
            value={values.paymentDeadlineHours}
            onChange={set("paymentDeadlineHours")}
          />
          <span className="mt-1 block text-[11px] text-slate-400">
            Після дедлайну знижка згорає, квиток лишається за повною ціною.
          </span>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-slate-600">
            Очікування зарахування, хв
          </span>
          <input
            type="number"
            min={1}
            step={1}
            className={inputClass}
            value={values.paymentSettleMinutes}
            onChange={set("paymentSettleMinutes")}
          />
          <span className="mt-1 block text-[11px] text-slate-400">
            Зазвичай 20–30 хв — потім статус стає «оплачено онлайн».
          </span>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-slate-600">
            Бронь місця на сесію, хв
          </span>
          <input
            type="number"
            min={1}
            step={1}
            className={inputClass}
            value={values.seatHoldMinutes}
            onChange={set("seatHoldMinutes")}
          />
          <span className="mt-1 block text-[11px] text-slate-400">
            Скільки місце триматиметься за пасажиром під час бронювання.
          </span>
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" className={btnPrimary} onClick={save} disabled={busy}>
          {busy ? "Збереження…" : "Зберегти"}
        </button>
        {message ? <span className="text-sm text-emerald-700">{message}</span> : null}
        {error ? <span className="text-sm text-rose-700">{error}</span> : null}
      </div>
    </div>
  );
}
