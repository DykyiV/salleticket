"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Passenger = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
};

/**
 * Inline editor for passenger details on the admin ticket page. Saves via
 * PATCH /api/admin/tickets/[id]/passenger; the server records the change in
 * the ticket history with a field-level diff.
 */
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

  function cancel() {
    setFirstName(passenger.firstName);
    setLastName(passenger.lastName);
    setPhone(passenger.phone);
    setEmail(passenger.email ?? "");
    setError(null);
    setEditing(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}/passenger`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          email: email.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? `Save failed (${res.status})`);
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="self-start rounded-lg px-3 py-1.5 text-xs font-medium text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-50"
      >
        Edit passenger
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="First name" value={firstName} onChange={setFirstName} />
        <Field label="Last name" value={lastName} onChange={setLastName} />
        <Field label="Phone" value={phone} onChange={setPhone} />
        <Field
          label="Email"
          value={email}
          onChange={setEmail}
          placeholder="optional"
        />
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 ring-1 ring-slate-300 transition hover:bg-white disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      <p className="text-xs text-slate-400">
        Every change is written to the ticket history with the old and new
        values.
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
      {label}
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border-0 px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-500"
      />
    </label>
  );
}
