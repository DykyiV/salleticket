"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Rule = {
  id: string;
  fromCity: string;
  toCity: string;
  percent: number;
};

type Carrier = {
  id: string;
  name: string;
  commissionPercent: number;
  commissionRules: Rule[];
};

/**
 * Interactive commission management: edit carrier defaults, add/update
 * route rules, delete rules. All changes apply to future bookings only.
 */
export default function CommissionManager({
  carriers,
}: {
  carriers: Carrier[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  const refresh = (note: string) => {
    setMessage(note);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      {message ? (
        <p className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm text-brand-800">
          {message}
        </p>
      ) : null}

      {carriers.map((carrier) => (
        <CarrierCard
          key={carrier.id}
          carrier={carrier}
          onDone={refresh}
          onError={(m) => setMessage(m)}
        />
      ))}

      {carriers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No carriers yet — they appear after the first booking or via the seed.
        </p>
      ) : null}
    </div>
  );
}

function CarrierCard({
  carrier,
  onDone,
  onError,
}: {
  carrier: Carrier;
  onDone: (note: string) => void;
  onError: (msg: string) => void;
}) {
  const [defaultPercent, setDefaultPercent] = useState(
    String(carrier.commissionPercent)
  );
  const [savingDefault, setSavingDefault] = useState(false);
  const [fromCity, setFromCity] = useState("");
  const [toCity, setToCity] = useState("");
  const [rulePercent, setRulePercent] = useState("");
  const [adding, setAdding] = useState(false);

  const saveDefault = async (e: FormEvent) => {
    e.preventDefault();
    setSavingDefault(true);
    try {
      const res = await fetch("/api/admin/commissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrierId: carrier.id,
          percent: Number.parseFloat(defaultPercent),
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        onError(data.error ?? `Failed with status ${res.status}`);
      } else {
        onDone(`${carrier.name}: default commission updated to ${defaultPercent}%.`);
      }
    } finally {
      setSavingDefault(false);
    }
  };

  const addRule = async (e: FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch("/api/admin/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrierId: carrier.id,
          fromCity,
          toCity,
          percent: Number.parseFloat(rulePercent),
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        onError(data.error ?? `Failed with status ${res.status}`);
      } else {
        setFromCity("");
        setToCity("");
        setRulePercent("");
        onDone(`${carrier.name}: rule ${fromCity} → ${toCity} saved.`);
      }
    } finally {
      setAdding(false);
    }
  };

  const deleteRule = async (rule: Rule) => {
    const res = await fetch(`/api/admin/commissions?id=${rule.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      onError(`Failed to delete rule (${res.status})`);
    } else {
      onDone(`${carrier.name}: rule ${rule.fromCity} → ${rule.toCity} removed.`);
    }
  };

  return (
    <section className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-slate-900">{carrier.name}</h2>

        <form onSubmit={saveDefault} className="flex items-end gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Default commission, %
            </span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={defaultPercent}
              onChange={(e) => setDefaultPercent(e.target.value)}
              className="h-10 w-28 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>
          <button
            type="submit"
            disabled={savingDefault}
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
          >
            {savingDefault ? "Saving…" : "Save"}
          </button>
        </form>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Route rules
        </p>
        {carrier.commissionRules.length > 0 ? (
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {carrier.commissionRules.map((rule) => (
              <li
                key={rule.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <span className="text-slate-700">
                  {rule.fromCity} → {rule.toCity}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold text-slate-900">
                    {rule.percent}%
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteRule(rule)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-400">
            No route rules — the default commission applies everywhere.
          </p>
        )}

        <form onSubmit={addRule} className="mt-3 flex flex-wrap items-end gap-2">
          <RuleField label="From" value={fromCity} onChange={setFromCity} placeholder="Kyiv" />
          <RuleField label="To" value={toCity} onChange={setToCity} placeholder="Lviv" />
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              %
            </span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              required
              value={rulePercent}
              onChange={(e) => setRulePercent(e.target.value)}
              className="h-10 w-20 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>
          <button
            type="submit"
            disabled={adding}
            className="inline-flex h-10 items-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add rule"}
          </button>
        </form>
      </div>
    </section>
  );
}

function RuleField({
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
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        type="text"
        required
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-36 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
      />
    </label>
  );
}
