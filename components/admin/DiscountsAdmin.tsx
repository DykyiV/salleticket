"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export type DiscountRow = {
  id: string;
  code: string;
  percent: number;
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
  percentInput: string;
  label: string;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  userEmail: string;
};

const EMPTY: FormValues = {
  code: "",
  percentInput: "10",
  label: "",
  isActive: true,
  startsAt: "",
  endsAt: "",
  usageLimit: "",
  userEmail: "",
};

/** Convert a DB row into form values for editing. */
function rowToForm(r: DiscountRow): FormValues {
  const date = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
  return {
    code: r.code,
    percentInput: String(Math.round(r.percent * 100)),
    label: r.label ?? "",
    isActive: r.isActive,
    startsAt: date(r.startsAt),
    endsAt: date(r.endsAt),
    usageLimit: r.usageLimit == null ? "" : String(r.usageLimit),
    userEmail: r.userEmail ?? "",
  };
}

/** Build a JSON payload for /api/admin/discounts (create or patch). */
function formToPayload(v: FormValues) {
  // percent is entered as a whole number ("10" -> 10 %) or a fraction ("0.1")
  return {
    code: v.code.trim(),
    percent: v.percentInput.trim(),
    label: v.label.trim() || null,
    isActive: v.isActive,
    startsAt: v.startsAt || null,
    endsAt: v.endsAt || null,
    usageLimit: v.usageLimit.trim() === "" ? null : v.usageLimit.trim(),
    userEmail: v.userEmail.trim() || null,
  };
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
  const title = isEditing ? "Edit discount" : "Create discount";
  const submitLabel = isEditing ? "Save changes" : "Create";

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
      const updated: DiscountRow = toRow(data.discount);
      setDiscounts((list) => {
        if (isEditing) {
          return list.map((d) => (d.id === updated.id ? updated : d));
        }
        return [updated, ...list];
      });
      resetForm();
      // Keep server-rendered data in sync if the admin navigates away and back.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (row: DiscountRow) => {
    const next = !row.isActive;
    // Optimistic update
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
      // Roll back on failure
      setDiscounts((list) =>
        list.map((d) => (d.id === row.id ? { ...d, isActive: !next } : d))
      );
      setError(err instanceof Error ? err.message : "Failed to toggle");
    }
  };

  const deleteRow = async (row: DiscountRow) => {
    if (!window.confirm(`Delete ${row.code}? This cannot be undone.`)) return;
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
          <p className="text-sm font-semibold text-slate-900">
            All discounts
            <span className="ml-2 rounded-full bg-slate-200/70 px-2 py-0.5 text-[11px] text-slate-600">
              {discounts.length}
            </span>
          </p>
          <button
            type="button"
            onClick={resetForm}
            className="text-xs font-medium text-brand-700 hover:underline"
          >
            + New discount
          </button>
        </header>

        {sorted.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No discounts yet. Create one with the form on the right.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 text-sm">
            {sorted.map((d) => (
              <DiscountListItem
                key={d.id}
                row={d}
                isSelected={editingId === d.id}
                onEdit={() => startEdit(d)}
                onToggle={() => toggleActive(d)}
                onDelete={() => deleteRow(d)}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="lg:sticky lg:top-20 lg:self-start">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {isEditing ? (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-slate-500 hover:text-slate-900"
              >
                Cancel
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Code"
              required
              placeholder="DISCOUNT10"
              value={values.code}
              onChange={(e) =>
                setField("code", e.target.value.toUpperCase().replace(/\s+/g, ""))
              }
              className="uppercase tracking-wider"
            />
            <Field
              label="Percent"
              required
              type="number"
              step="1"
              min="1"
              max="99"
              placeholder="10"
              value={values.percentInput}
              onChange={(e) => setField("percentInput", e.target.value)}
              suffix="%"
            />
          </div>

          <div className="mt-3">
            <Field
              label="Label (optional)"
              placeholder="Summer sale"
              value={values.label}
              onChange={(e) => setField("label", e.target.value)}
            />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Starts at"
              type="date"
              value={values.startsAt}
              onChange={(e) => setField("startsAt", e.target.value)}
            />
            <Field
              label="Ends at"
              type="date"
              value={values.endsAt}
              onChange={(e) => setField("endsAt", e.target.value)}
            />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Usage limit"
              type="number"
              min="0"
              step="1"
              placeholder="unlimited"
              value={values.usageLimit}
              onChange={(e) => setField("usageLimit", e.target.value)}
            />
            <Field
              label="Bind to user (email)"
              type="email"
              placeholder="everyone"
              value={values.userEmail}
              onChange={(e) => setField("userEmail", e.target.value)}
            />
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={values.isActive}
              onChange={(e) => setField("isActive", e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Active
          </label>

          {error ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand-600 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "Saving…" : submitLabel}
          </button>
        </form>
      </section>
    </div>
  );
}

function DiscountListItem({
  row,
  isSelected,
  onEdit,
  onToggle,
  onDelete,
}: {
  row: DiscountRow;
  isSelected: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const percentLabel = `-${Math.round(row.percent * 100)}%`;
  const validity = formatWindow(row.startsAt, row.endsAt);
  const usage =
    row.usageLimit == null
      ? `${row.usedCount} used`
      : `${row.usedCount} / ${row.usageLimit}`;

  return (
    <li
      className={`flex flex-wrap items-center gap-3 px-5 py-4 transition ${
        isSelected ? "bg-brand-50/60" : "hover:bg-slate-50"
      }`}
    >
      <div className="min-w-[200px] flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold tracking-wider text-slate-800">
            {row.code}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              row.isActive
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {row.isActive ? "active" : "inactive"}
          </span>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-100">
            {percentLabel}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-slate-500">
          {row.label ?? "—"} · {validity} · {usage}
          {row.userEmail ? ` · for ${row.userEmail}` : " · everyone"}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2 text-xs">
        <button
          type="button"
          onClick={onToggle}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
        >
          {row.isActive ? "Deactivate" : "Activate"}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg bg-brand-600 px-2 py-1 font-semibold text-white transition hover:bg-brand-700"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
        >
          Delete
        </button>
      </div>
    </li>
  );
}

function formatWindow(start: string | null, end: string | null): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  if (!start && !end) return "any date";
  if (start && !end) return `from ${fmt(start)}`;
  if (!start && end) return `until ${fmt(end)}`;
  return `${fmt(start!)} → ${fmt(end!)}`;
}

type ApiDiscount = {
  id: string;
  code: string;
  percent: number;
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
    percent: d.percent,
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

type FieldProps = {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  min?: string;
  max?: string;
  step?: string;
  suffix?: string;
};

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  className,
  suffix,
  ...rest
}: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          {...rest}
          className={`h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 ${
            suffix ? "pr-10" : ""
          } ${className ?? ""}`}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
            {suffix}
          </span>
        ) : null}
      </div>
    </label>
  );
}
