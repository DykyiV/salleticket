"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type UserRow = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
};

const ALL_ROLES = ["USER", "AGENT", "ADMIN", "SUPER_ADMIN"] as const;

export default function UsersAdmin({
  initialUsers,
  currentUserId,
  canAssignElevatedRoles,
}: {
  initialUsers: UserRow[];
  currentUserId: string;
  /** Only SUPER_ADMIN may assign ADMIN / SUPER_ADMIN — see /api/admin/users. */
  canAssignElevatedRoles: boolean;
}) {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const availableRoles: readonly (typeof ALL_ROLES)[number][] = canAssignElevatedRoles
    ? ALL_ROLES
    : ["USER", "AGENT"];

  const changeRole = async (row: UserRow, role: string) => {
    if (role === row.role) return;
    const prev = row.role;
    setSavingId(row.id);
    setError(null);
    setUsers((list) => list.map((u) => (u.id === row.id ? { ...u, role } : u)));
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: row.id, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Не вдалося змінити роль");
      router.refresh();
    } catch (err) {
      setUsers((list) => list.map((u) => (u.id === row.id ? { ...u, role: prev } : u)));
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-4 py-2">Email</th>
              <th className="border-b border-slate-200 px-4 py-2">Роль</th>
              <th className="border-b border-slate-200 px-4 py-2">Зареєстрований</th>
            </tr>
          </thead>
          <tbody>
            {users.map((row) => {
              const isSelf = row.id === currentUserId;
              // Can this viewer even offer the row's current role as an option?
              // (e.g. an ADMIN viewing a SUPER_ADMIN row can't assign roles to
              // them at all — show it read-only.)
              const roleOptions = availableRoles.includes(row.role as (typeof ALL_ROLES)[number])
                ? availableRoles
                : null;
              return (
                <tr key={row.id} className="odd:bg-white even:bg-slate-50">
                  <td className="border-t border-slate-100 px-4 py-2">
                    {row.email}
                    {isSelf ? (
                      <span className="ml-2 text-xs text-slate-400">(ви)</span>
                    ) : null}
                  </td>
                  <td className="border-t border-slate-100 px-4 py-2">
                    {roleOptions && !isSelf ? (
                      <select
                        value={row.role}
                        disabled={savingId === row.id}
                        onChange={(e) => changeRole(row, e.target.value)}
                        className="h-8 rounded border border-slate-300 bg-white px-1.5 text-xs disabled:opacity-60"
                      >
                        {roleOptions.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {row.role}
                      </span>
                    )}
                  </td>
                  <td className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                    {new Date(row.createdAt).toLocaleDateString("uk-UA")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
