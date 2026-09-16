"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ManagedUser = {
  id: string;
  email: string;
  role: string;
  canViewAllTickets: boolean;
  createdAt: string | Date;
};

const ROLES = ["USER", "AGENT", "ADMIN", "SUPER_ADMIN"] as const;

/**
 * Users tab: change roles and toggle the "view all passengers' tickets"
 * permission per user. Role changes to ADMIN/SUPER_ADMIN require
 * SUPER_ADMIN (enforced by the API).
 */
export default function UsersManager({
  users,
  currentUserId,
}: {
  users: ManagedUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patch = async (userId: string, body: Record<string, unknown>) => {
    setBusy(userId);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...body }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? `Failed with status ${res.status}`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
      {error ? (
        <p className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <Th>Email</Th>
            <Th>Role</Th>
            <Th>Can view all tickets</Th>
            <Th>Joined</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-3 font-medium text-slate-900">
                {u.email}
                {u.id === currentUserId ? (
                  <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <select
                  value={u.role}
                  disabled={busy === u.id}
                  onChange={(e) => patch(u.id, { role: e.target.value })}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-50"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={u.canViewAllTickets}
                  disabled={busy === u.id}
                  onClick={() =>
                    patch(u.id, { canViewAllTickets: !u.canViewAllTickets })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition disabled:opacity-50 ${
                    u.canViewAllTickets ? "bg-brand-600" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                      u.canViewAllTickets ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="ml-2 text-xs text-slate-500">
                  {u.canViewAllTickets ? "all passengers" : "own only"}
                </span>
              </td>
              <td className="px-4 py-3 tabular-nums text-slate-500">
                {new Date(u.createdAt).toISOString().slice(0, 10)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}
