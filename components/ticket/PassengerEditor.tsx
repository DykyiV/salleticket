"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Field, { btnGhost, btnPrimary, inputClass } from "@/components/admin/Field";

type Passenger = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
};

export default function PassengerEditor({
  ticketId,
  passenger,
}: {
  ticketId: string;
  passenger: Passenger;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(passenger.firstName);
  const [lastName, setLastName] = useState(passenger.lastName);
  const [phone, setPhone] = useState(passenger.phone);
  const [email, setEmail] = useState(passenger.email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const cancel = () => {
    setFirstName(passenger.firstName);
    setLastName(passenger.lastName);
    setPhone(passenger.phone);
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
          email: email.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Не вдалося зберегти");
      setEditing(false);
      setMessage("Збережено.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Імʼя">
          <input
            className={inputClass}
            value={firstName}
            disabled={!editing}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </Field>
        <Field label="Прізвище">
          <input
            className={inputClass}
            value={lastName}
            disabled={!editing}
            onChange={(e) => setLastName(e.target.value)}
          />
        </Field>
        <Field label="Телефон">
          <input
            className={inputClass}
            value={phone}
            disabled={!editing}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <Field label="Email">
          <input
            className={inputClass}
            value={email}
            disabled={!editing}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
      </div>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      <div className="flex gap-2">
        {editing ? (
          <>
            <button type="button" className={btnPrimary} disabled={busy} onClick={save}>
              {busy ? "Збереження…" : "Зберегти"}
            </button>
            <button type="button" className={btnGhost} disabled={busy} onClick={cancel}>
              Скасувати
            </button>
          </>
        ) : (
          <button type="button" className={btnGhost} onClick={() => setEditing(true)}>
            Редагувати пасажира
          </button>
        )}
      </div>
    </div>
  );
}
