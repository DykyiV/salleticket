"use client";

import { useState } from "react";
import { ROLE_LABEL } from "@/lib/auth/constants";
import type { Role } from "@prisma/client";
import { inputClass } from "@/components/admin/Field";

export type NotificationRuleRow = {
  kind: string;
  label: string;
  enabled: boolean;
  roles: Role[];
  thresholdMin: number | null;
  thresholdLabel?: string;
};

const STAFF_ROLES: Role[] = [
  "DISPATCHER",
  "CALL_CENTER",
  "ACCOUNTANT",
  "AGENT",
  "MANAGER",
  "ADMIN",
];

export default function NotificationRules({
  initialRules,
}: {
  initialRules: NotificationRuleRow[];
}) {
  const [rules, setRules] = useState(initialRules);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const save = async (rule: NotificationRuleRow) => {
    setError(null);
    setSaved(null);
    try {
      const res = await fetch("/api/admin/notification-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: rule.kind,
          enabled: rule.enabled,
          roles: rule.roles,
          thresholdMin: rule.thresholdMin,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Не вдалося зберегти");
      setSaved(rule.label);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    }
  };

  const update = (kind: string, patch: Partial<NotificationRuleRow>) => {
    setRules((list) =>
      list.map((r) => {
        if (r.kind !== kind) return r;
        const next = { ...r, ...patch };
        void save(next);
        return next;
      })
    );
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
      <ul className="divide-y divide-slate-100">
        {rules.map((rule) => (
          <li key={rule.kind} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(e) => update(rule.kind, { enabled: e.target.checked })}
                />
                {rule.label}
              </label>
              {rule.thresholdLabel ? (
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  <input
                    type="number"
                    min={1}
                    className={`${inputClass} w-16`}
                    value={rule.thresholdMin ?? ""}
                    onChange={(e) =>
                      update(rule.kind, {
                        thresholdMin: Number(e.target.value) || null,
                      })
                    }
                  />
                  {rule.thresholdLabel}
                </label>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {STAFF_ROLES.map((role) => {
                const active = rule.roles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() =>
                      update(rule.kind, {
                        roles: active
                          ? rule.roles.filter((r) => r !== role)
                          : [...rule.roles, role],
                      })
                    }
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                      active
                        ? "bg-brand-50 text-brand-800 ring-brand-200"
                        : "bg-slate-50 text-slate-500 ring-slate-200"
                    }`}
                  >
                    {ROLE_LABEL[role]}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      <div className="border-t border-slate-100 px-4 py-2 text-xs">
        {saved ? <span className="text-emerald-700">Збережено: {saved}</span> : null}
        {error ? <span className="text-rose-700">{error}</span> : null}
      </div>
    </div>
  );
}
