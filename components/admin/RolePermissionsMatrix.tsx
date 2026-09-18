"use client";

import { useState } from "react";
import { ROLE_LABEL } from "@/lib/auth/constants";
import {
  PERMISSION_LABEL,
  type Permission,
} from "@/lib/auth/permissions";
import type { Role } from "@prisma/client";

type Grant = { role: Role; permission: string; allowed: boolean };

const EDITABLE_ROLES: Role[] = [
  "CUSTOMER",
  "PARTNER",
  "DRIVER",
  "DISPATCHER",
  "CALL_CENTER",
  "ACCOUNTANT",
  "AGENT",
  "MANAGER",
];

export default function RolePermissionsMatrix({
  roles,
  permissions,
  grants,
}: {
  roles: Role[];
  permissions: Permission[];
  grants: Grant[];
}) {
  const [map, setMap] = useState(() => {
    const m = new Map<string, boolean>();
    for (const g of grants) {
      m.set(`${g.role}:${g.permission}`, g.allowed);
    }
    return m;
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const isAllowed = (role: Role, permission: Permission) =>
    map.get(`${role}:${permission}`) ?? false;

  const toggle = async (role: Role, permission: Permission) => {
    const next = !isAllowed(role, permission);
    setMap((prev) => new Map(prev).set(`${role}:${permission}`, next));
    setError(null);
    try {
      const res = await fetch("/api/admin/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, permission, allowed: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Не вдалося зберегти");
      setSaved(`${ROLE_LABEL[role]} · ${PERMISSION_LABEL[permission]}`);
    } catch (err) {
      setMap((prev) => new Map(prev).set(`${role}:${permission}`, !next));
      setError(err instanceof Error ? err.message : "Помилка");
    }
  };

  return (
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Дозвіл</th>
            {EDITABLE_ROLES.map((role) => (
              <th key={role} className="px-2 py-2 text-center">
                {ROLE_LABEL[role]}
              </th>
            ))}
            <th className="px-2 py-2 text-center text-slate-400">Адмін</th>
          </tr>
        </thead>
        <tbody>
          {permissions.map((permission) => (
            <tr key={permission} className="border-t border-slate-100">
              <td className="px-3 py-1.5 font-medium text-slate-700">
                {PERMISSION_LABEL[permission]}
                <span className="ml-1 font-mono text-[10px] text-slate-400">
                  {permission}
                </span>
              </td>
              {EDITABLE_ROLES.map((role) => (
                <td key={role} className="px-2 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={isAllowed(role, permission)}
                    onChange={() => void toggle(role, permission)}
                  />
                </td>
              ))}
              <td className="px-2 py-1.5 text-center">
                <input type="checkbox" checked disabled />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-3 border-t border-slate-100 px-3 py-2">
        {saved ? (
          <span className="text-xs text-emerald-700">Збережено: {saved}</span>
        ) : null}
        {error ? <span className="text-xs text-rose-700">{error}</span> : null}
      </div>
    </div>
  );
}
