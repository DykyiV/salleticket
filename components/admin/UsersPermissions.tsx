"use client";

import { useState } from "react";
import type { Role } from "@prisma/client";
import { ROLE_LABEL } from "@/lib/auth/constants";
import { userChangeRefusal } from "@/lib/auth/userAdmin";

export type UserRow = {
  id: string;
  email: string;
  role: Role;
  canEditDepartures: boolean;
  canHideStops: boolean;
  canHideSeats: boolean;
  createdAt: string;
};

type Props = {
  initialUsers: UserRow[];
  /** The signed-in manager — decides which rows and roles are editable. */
  actor: { id: string; role: Role };
};

export default function UsersPermissions({ initialUsers, actor }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState<string | null>(null);

  const patch = async (userId: string, body: Record<string, unknown>) => {
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Не вдалося оновити");
    setUsers((list) => list.map((u) => (u.id === data.user.id ? data.user : u)));
  };

  const toggle = async (
    row: UserRow,
    field: "canEditDepartures" | "canHideStops" | "canHideSeats"
  ) => {
    const next = !row[field];
    setUsers((list) =>
      list.map((u) => (u.id === row.id ? { ...u, [field]: next } : u))
    );
    try {
      await patch(row.id, { [field]: next });
    } catch (err) {
      setUsers((list) =>
        list.map((u) => (u.id === row.id ? { ...u, [field]: !next } : u))
      );
      setError(err instanceof Error ? err.message : "Помилка");
    }
  };

  return (
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
      {error ? <p className="px-4 pt-3 text-sm text-rose-700">{error}</p> : null}
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Користувач</th>
            <th className="px-4 py-2">Роль</th>
            <th className="px-4 py-2">Редагувати виїзди</th>
            <th className="px-4 py-2">Приховувати міста</th>
            <th className="px-4 py-2">Приховувати місця</th>
          </tr>
        </thead>
        <tbody>
          {users.map((row) => {
            const superAdmins = users.filter((u) => u.role === "SUPER_ADMIN").length;
            const locked = userChangeRefusal({ actor, target: row, superAdminCount: superAdmins });
            const assignable = (Object.keys(ROLE_LABEL) as Role[]).filter(
              (role) =>
                role === row.role ||
                !userChangeRefusal({ actor, target: row, newRole: role, superAdminCount: superAdmins })
            );
            return (
            <tr key={row.id} className="border-t border-slate-100" title={locked ?? undefined}>
              <td className="px-4 py-3">
                {row.email}
                {locked ? <span className="ml-2 text-[11px] text-slate-400">🔒 {locked}</span> : null}
              </td>
              <td className="px-4 py-3">
                <select
                  className="rounded border border-slate-300 bg-white px-1.5 py-1 text-xs"
                  value={row.role}
                  disabled={Boolean(locked)}
                  onChange={async (e) => {
                    const role = e.target.value as Role;
                    const prev = row.role;
                    setUsers((list) =>
                      list.map((u) => (u.id === row.id ? { ...u, role } : u))
                    );
                    try {
                      await patch(row.id, { role });
                    } catch (err) {
                      setUsers((list) =>
                        list.map((u) =>
                          u.id === row.id ? { ...u, role: prev } : u
                        )
                      );
                      setError(
                        err instanceof Error ? err.message : "Помилка"
                      );
                    }
                  }}
                >
                  {assignable.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABEL[role]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={row.canEditDepartures || row.role === "ADMIN" || row.role === "SUPER_ADMIN"}
                  disabled={Boolean(locked) || row.role === "ADMIN" || row.role === "SUPER_ADMIN"}
                  onChange={() => toggle(row, "canEditDepartures")}
                />
              </td>
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={row.canHideStops || row.role === "ADMIN" || row.role === "SUPER_ADMIN"}
                  disabled={Boolean(locked) || row.role === "ADMIN" || row.role === "SUPER_ADMIN"}
                  onChange={() => toggle(row, "canHideStops")}
                />
              </td>
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={row.canHideSeats || row.role === "ADMIN" || row.role === "SUPER_ADMIN"}
                  disabled={Boolean(locked) || row.role === "ADMIN" || row.role === "SUPER_ADMIN"}
                  onChange={() => toggle(row, "canHideSeats")}
                />
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-4 py-3 text-xs text-slate-500">
        Адміни мають усі права завжди. Для агента ввімкніть окремі галочки — тоді
        він зможе масово редагувати виїзди на своїй сторінці.
      </p>
    </div>
  );
}
