"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Field, { btnGhost, btnPrimary, inputClass } from "@/components/admin/Field";

type Passenger = {
  firstName: string;
  lastName: string;
  phone: string;
  phone2?: string | null;
  phone3?: string | null;
  email: string | null;
};

export default function PassengerEditor({
  ticketId,
  passenger,
  category,
  canEdit = true,
}: {
  ticketId: string;
  passenger: Passenger;
  /** Age category label shown next to the name. */
  category?: string;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(canEdit);
  const [firstName, setFirstName] = useState(passenger.firstName);
  const [lastName, setLastName] = useState(passenger.lastName);
  const [phone, setPhone] = useState(passenger.phone);
  const [phone2, setPhone2] = useState(passenger.phone2 ?? "");
  const [phone3, setPhone3] = useState(passenger.phone3 ?? "");
  const [email, setEmail] = useState(passenger.email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const cancel = () => {
    setFirstName(passenger.firstName);
    setLastName(passenger.lastName);
    setPhone(passenger.phone);
    setPhone2(passenger.phone2 ?? "");
    setPhone3(passenger.phone3 ?? "");
    setEmail(passenger.email ?? "");
    setError(null);
    setEditing(false);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/account/tickets/${ticketId}/passenger`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          phone2: phone2.trim(),
          phone3: phone3.trim(),
          email: email.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Не вдалося зберегти");
      setMessage("Збережено.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    // Compact read view: one line per fact, editing on demand.
    return (
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-base font-semibold text-slate-900">
            {passenger.firstName} {passenger.lastName}
            {category ? <span className="ml-2 text-xs font-normal text-slate-500">{category}</span> : null}
          </p>
          {canEdit ? (
            <button
              type="button"
              onClick={() => {
                setMessage(null);
                setEditing(true);
              }}
              className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700"
            >
              Редагувати
            </button>
          ) : null}
        </div>
        <p className="text-sm text-slate-700">
          <a href={`tel:${passenger.phone}`} className="tabular-nums hover:underline">
            {passenger.phone}
          </a>
          {[passenger.phone2, passenger.phone3].filter(Boolean).map((extra) => (
            <span key={extra}>
              {" · "}
              <a href={`tel:${extra}`} className="tabular-nums hover:underline">
                {extra}
              </a>
            </span>
          ))}
          {passenger.email ? <span className="text-slate-500"> · {passenger.email}</span> : null}
        </p>
        {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Імʼя, прізвище і телефон можна виправити, якщо в даних помилка.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Імʼя *">
          <input
            className={inputClass}
            value={firstName}
            required
            onChange={(e) => setFirstName(e.target.value)}
          />
        </Field>
        <Field label="Прізвище *">
          <input
            className={inputClass}
            value={lastName}
            required
            onChange={(e) => setLastName(e.target.value)}
          />
        </Field>
        <Field label="Телефон *">
          <input
            className={inputClass}
            value={phone}
            required
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <Field label="Телефон 2">
          <input className={inputClass} value={phone2} onChange={(e) => setPhone2(e.target.value)} />
        </Field>
        <Field label="Телефон 3">
          <input className={inputClass} value={phone3} onChange={(e) => setPhone3(e.target.value)} />
        </Field>
        <Field label="Email">
          <input
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
      </div>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      <div className="flex gap-2">
        <button type="button" className={btnPrimary} disabled={busy} onClick={save}>
          {busy ? "Збереження…" : "Зберегти"}
        </button>
        <button type="button" className={btnGhost} disabled={busy} onClick={cancel}>
          Скасувати
        </button>
      </div>
    </div>
  );
}
