"use client";

import { useState } from "react";
import { PriceCalendar } from "@/components/home/DatePicker";
import { btnGhost, btnPrimary } from "@/components/admin/Field";
import { formatUkDate } from "@/lib/routes/dates";

/**
 * A passenger asks to move a trip: the wished date (route price calendar) and
 * a comment go to the office by e-mail; a manager or dispatcher changes it.
 */
export default function ChangeRequestModal({
  ticketId,
  legs,
  initialLeg,
  onClose,
}: {
  ticketId: string;
  legs: { key: "outbound" | "return"; label: string; fromCity: string; toCity: string; date: string | null }[];
  initialLeg: "outbound" | "return";
  onClose: () => void;
}) {
  const [leg, setLeg] = useState(initialLeg);
  const current = legs.find((l) => l.key === leg) ?? legs[0];
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState("");
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!date) {
      setError("Оберіть бажану дату в календарі");
      return;
    }
    setError(null);
    setState("sending");
    try {
      const res = await fetch(`/api/account/tickets/${ticketId}/change-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leg, date, comment }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Не вдалося надіслати запит");
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
      setState("idle");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Змінити дату поїздки</h2>
          <button type="button" className={btnGhost} onClick={onClose}>
            Закрити
          </button>
        </div>
        {state === "sent" ? (
          <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-100">
            Запит надіслано. Менеджер перевірить вільні місця на {formatUkDate(date)} і зв&apos;яжеться з вами.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-500">
              Оберіть бажану дату — менеджер перевірить вільні місця й підтвердить зміну. Ціна може залежати від
              рейсу.
            </p>
            {legs.length > 1 ? (
              <div className="mt-3 flex gap-2">
                {legs.map((l) => (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() => {
                      setLeg(l.key);
                      setDate("");
                    }}
                    className={`rounded-lg px-3 py-1.5 text-sm ring-1 ${
                      leg === l.key ? "bg-brand-50 font-semibold text-brand-800 ring-brand-300" : "bg-white text-slate-600 ring-slate-200"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            ) : null}
            <p className="mt-3 text-sm text-slate-700">
              {current.fromCity} → {current.toCity}
              {current.date ? <span className="text-slate-500"> · зараз {formatUkDate(current.date)}</span> : null}
            </p>
            <div className="mt-3 max-w-sm">
              <PriceCalendar value={date} min={today} from={current.fromCity} to={current.toCity} onPick={setDate} />
            </div>
            <label className="mt-3 block text-xs">
              <span className="mb-1 block font-medium text-slate-600">Коментар (необов&apos;язково)</span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                maxLength={1000}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="Наприклад: бажано вікно, будь-який час"
              />
            </label>
            {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={btnGhost} onClick={onClose} disabled={state === "sending"}>
                Скасувати
              </button>
              <button type="button" className={btnPrimary} onClick={send} disabled={state === "sending"}>
                {state === "sending" ? "Надсилаю…" : `Надіслати запит${date ? ` на ${formatUkDate(date)}` : ""}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
