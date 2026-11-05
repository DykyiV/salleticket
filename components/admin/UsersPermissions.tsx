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
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("CUSTOMER");
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const creatable = (Object.keys(ROLE_LABEL) as Role[]).filter(
    (role) =>
      !userChangeRefusal({
        actor,
        target: { id: "", role: "CUSTOMER" },
        newRole: role,
        superAdminCount: users.filter((u) => u.role === "SUPER_ADMIN").length,
      })
  );

  /** New user or new password: the temporary password is shown once. */
  const issue = async (body: Record<string, unknown>): Promise<UserRow | null> => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Не вдалося");
      setIssued({ email: data.user.email, password: data.password });
      return data.user as UserRow;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = await issue({ email: newEmail, role: newRole });
    if (user) {
      setUsers((list) => [user, ...list]);
      setNewEmail("");
    }
  };

  const resetPassword = async (row: UserRow) => {
    if (!window.confirm(`Видати новий пароль для ${row.email}? Старий перестане діяти.`)) return;
    await issue({ userId: row.id });
  };

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
      <form onSubmit={create} className="flex flex-wrap items-end gap-2 border-b border-slate-100 px-4 py-3">
        <label className="text-xs text-slate-500">
          Новий користувач (e-mail)
          <input
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="mt-1 block w-64 rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
          />
        </label>
        <label className="text-xs text-slate-500">
          Роль
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as Role)}
            className="mt-1 block rounded border border-slate-300 bg-white px-1.5 py-1 text-sm text-slate-900"
          >
            {creatable.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Додати
        </button>
      </form>
      {issued ? (
        <div className="mx-4 mt-3 rounded-xl bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
          Тимчасовий пароль для <b>{issued.email}</b>:{" "}
          <code className="select-all rounded bg-white px-1.5 py-0.5 font-mono text-base">{issued.password}</code>
          <p className="mt-1 text-xs text-slate-600">
            Передайте його людині телефоном чи в месенджері — більше його не покажемо. Після входу
            вона задасть свій пароль у профілі кабінету.
          </p>
          <button type="button" onClick={() => setIssued(null)} className="mt-1 text-xs text-slate-500 underline">
            Сховати
          </button>
        </div>
      ) : null}
      {error ? <p className="px-4 pt-3 text-sm text-rose-700">{error}</p> : null}
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Користувач</th>
            <th className="px-4 py-2">Роль</th>
            <th className="px-4 py-2">Редагувати виїзди</th>
            <th className="px-4 py-2">Приховувати міста</th>
            <th className="px-4 py-2">Приховувати місця</th>
            <th className="px-4 py-2">Пароль</th>
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
              <td className="px-4 py-3">
                <button
                  type="button"
                  disabled={Boolean(locked) || busy}
                  onClick={() => void resetPassword(row)}
                  className="whitespace-nowrap rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-40"
                >
                  Новий пароль
                </button>
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
