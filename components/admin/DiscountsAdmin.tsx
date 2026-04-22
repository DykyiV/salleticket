"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export type DiscountRow = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  percent: number;
  amount: number | null;
  label: string | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usedCount: number;
  userEmail: string | null;
  createdAt: string;
};

type FormValues = {
  code: string;
  type: "PERCENT" | "FIXED";
  value: string;
  label: string;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  userEmail: string;
};

const EMPTY: FormValues = {
  code: "",
  type: "PERCENT",
  value: "",
  label: "",
  isActive: true,
  startsAt: "",
  endsAt: "",
  usageLimit: "",
  userEmail: "",
};

function rowToForm(r: DiscountRow): FormValues {
  const date = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
  return {
    code: r.code,
    type: r.type,
    value:
      r.type === "FIXED"
        ? (r.amount ?? 0).toFixed(2)
        : String(Math.round(r.percent * 100)),
    label: r.label ?? "",
    isActive: r.isActive,
    startsAt: date(r.startsAt),
    endsAt: date(r.endsAt),
    usageLimit: r.usageLimit == null ? "" : String(r.usageLimit),
    userEmail: r.userEmail ?? "",
  };
}

function formToPayload(v: FormValues) {
  return {
    code: v.code.trim(),
    type: v.type,
    value: v.value.trim(),
    label: v.label.trim() || null,
    isActive: v.isActive,
    startsAt: v.startsAt || null,
    endsAt: v.endsAt || null,
    usageLimit: v.usageLimit.trim() === "" ? null : v.usageLimit.trim(),
    userEmail: v.userEmail.trim() || null,
  };
}

function formatValue(row: DiscountRow): string {
  return row.type === "FIXED"
    ? `€${(row.amount ?? 0).toFixed(2)}`
    : `${Math.round(row.percent * 100)}%`;
}

type Props = {
  initialDiscounts: DiscountRow[];
};

export default function DiscountsAdmin({ initialDiscounts }: Props) {
  const router = useRouter();
  const [discounts, setDiscounts] = useState<DiscountRow[]>(initialDiscounts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isEditing = editingId !== null;

  const sorted = useMemo(
    () => [...discounts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [discounts]
  );

  const setField = <K extends keyof FormValues>(field: K, value: FormValues[K]) => {
    setValues((v) => ({ ...v, [field]: value }));
  };

  const resetForm = () => {
    setEditingId(null);
    setValues(EMPTY);
    setError(null);
  };

  const startEdit = (row: DiscountRow) => {
    setEditingId(row.id);
    setValues(rowToForm(row));
    setError(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = formToPayload(values);
      const res = await fetch(
        isEditing
          ? `/api/admin/discounts/${editingId}`
          : "/api/admin/discounts",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Request failed");
      }
      const updated = toRow(data.discount);
      setDiscounts((list) =>
        isEditing
          ? list.map((d) => (d.id === updated.id ? updated : d))
          : [updated, ...list]
      );
      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (row: DiscountRow) => {
    const next = !row.isActive;
    setDiscounts((list) =>
      list.map((d) => (d.id === row.id ? { ...d, isActive: next } : d))
    );
    try {
      const res = await fetch(`/api/admin/discounts/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to toggle");
      }
    } catch (err) {
      setDiscounts((list) =>
        list.map((d) => (d.id === row.id ? { ...d, isActive: !next } : d))
      );
      setError(err instanceof Error ? err.message : "Failed to toggle");
    }
  };

  const deleteRow = async (row: DiscountRow) => {
    if (!window.confirm(`Delete ${row.code}?`)) return;
    const snapshot = discounts;
    setDiscounts((list) => list.filter((d) => d.id !== row.id));
    try {
      const res = await fetch(`/api/admin/discounts/${row.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to delete");
      }
      if (editingId === row.id) resetForm();
    } catch (err) {
      setDiscounts(snapshot);
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded border border-slate-300 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="border-b border-slate-300 px-3 py-2">Code</th>
              <th className="border-b border-slate-300 px-3 py-2">Type</th>
              <th className="border-b border-slate-300 px-3 py-2">Value</th>
              <th className="border-b border-slate-300 px-3 py-2">Usage</th>
              <th className="border-b border-slate-300 px-3 py-2">Active</th>
              <th className="border-b border-slate-300 px-3 py-2">Bound user</th>
              <th className="border-b border-slate-300 px-3 py-2 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  className="px-3 py-6 text-center text-slate-500"
                  colSpan={7}
                >
                  No discounts yet.
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr
                  key={row.id}
                  className={
                    editingId === row.id
                      ? "bg-yellow-50"
                      : "odd:bg-white even:bg-slate-50"
                  }
                >
                  <td className="border-t border-slate-200 px-3 py-2 font-mono">
                    {row.code}
                  </td>
                  <td className="border-t border-slate-200 px-3 py-2">
                    {row.type}
                  </td>
                  <td className="border-t border-slate-200 px-3 py-2">
                    {formatValue(row)}
                  </td>
                  <td className="border-t border-slate-200 px-3 py-2 tabular-nums">
                    {row.usedCount}
                    {row.usageLimit != null ? ` / ${row.usageLimit}` : ""}
                  </td>
                  <td className="border-t border-slate-200 px-3 py-2">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={row.isActive}
                        onChange={() => toggleActive(row)}
                      />
                      <span
                        className={
                          row.isActive ? "text-slate-900" : "text-slate-400"
                        }
                      >
                        {row.isActive ? "yes" : "no"}
                      </span>
                    </label>
                  </td>
                  <td className="border-t border-slate-200 px-3 py-2">
                    {row.userEmail ?? "—"}
                  </td>
                  <td className="border-t border-slate-200 px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      className="mr-2 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteRow(row)}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-rose-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded border border-slate-300 bg-white p-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {isEditing ? "Edit discount" : "Create discount"}
          </h2>
          {isEditing ? (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-slate-600 underline"
            >
              Cancel edit
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Code">
            <input
              type="text"
              value={values.code}
              onChange={(e) =>
                setField("code", e.target.value.toUpperCase().replace(/\s+/g, ""))
              }
              required
              placeholder="SUMMER10"
              className="h-9 w-full rounded border border-slate-300 px-2 font-mono uppercase"
            />
          </Field>

          <Field label="Type">
            <select
              value={values.type}
              onChange={(e) =>
                setField("type", e.target.value as "PERCENT" | "FIXED")
              }
              className="h-9 w-full rounded border border-slate-300 bg-white px-2"
            >
              <option value="PERCENT">Percent</option>
              <option value="FIXED">Fixed (€)</option>
            </select>
          </Field>

          <Field
            label={
              values.type === "FIXED"
                ? "Value (EUR)"
                : "Value (percent, 1–99)"
            }
          >
            <input
              type="number"
              min="0"
              step={values.type === "FIXED" ? "0.01" : "1"}
              value={values.value}
              onChange={(e) => setField("value", e.target.value)}
              required
              placeholder={values.type === "FIXED" ? "5.00" : "10"}
              className="h-9 w-full rounded border border-slate-300 px-2"
            />
          </Field>

          <Field label="Label (optional)">
            <input
              type="text"
              value={values.label}
              onChange={(e) => setField("label", e.target.value)}
              placeholder="Summer sale"
              className="h-9 w-full rounded border border-slate-300 px-2"
            />
          </Field>

          <Field label="Starts at">
            <input
              type="date"
              value={values.startsAt}
              onChange={(e) => setField("startsAt", e.target.value)}
              className="h-9 w-full rounded border border-slate-300 px-2"
            />
          </Field>

          <Field label="Ends at">
            <input
              type="date"
              value={values.endsAt}
              onChange={(e) => setField("endsAt", e.target.value)}
              className="h-9 w-full rounded border border-slate-300 px-2"
            />
          </Field>

          <Field label="Usage limit (blank = unlimited)">
            <input
              type="number"
              min="0"
              step="1"
              value={values.usageLimit}
              onChange={(e) => setField("usageLimit", e.target.value)}
              className="h-9 w-full rounded border border-slate-300 px-2"
            />
          </Field>

          <Field label="Bind to user (email, blank = everyone)">
            <input
              type="email"
              value={values.userEmail}
              onChange={(e) => setField("userEmail", e.target.value)}
              placeholder="user@example.com"
              className="h-9 w-full rounded border border-slate-300 px-2"
            />
          </Field>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(e) => setField("isActive", e.target.checked)}
          />
          Active
        </label>

        {error ? (
          <p className="mt-3 text-sm text-rose-700">{error}</p>
        ) : null}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitting ? "Saving…" : isEditing ? "Save changes" : "Create"}
          </button>
          {isEditing ? null : (
            <span className="text-xs text-slate-500">
              Fill in the fields and click Create.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

type ApiDiscount = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  percent: number;
  amount: number | null;
  label: string | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usedCount: number;
  createdAt: string;
  user?: { id: string; email: string } | null;
};

function toRow(d: ApiDiscount): DiscountRow {
  return {
    id: d.id,
    code: d.code,
    type: d.type,
    percent: d.percent,
    amount: d.amount,
    label: d.label,
    isActive: d.isActive,
    startsAt: d.startsAt,
    endsAt: d.endsAt,
    usageLimit: d.usageLimit,
    usedCount: d.usedCount,
    userEmail: d.user?.email ?? null,
    createdAt: d.createdAt,
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
