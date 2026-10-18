import type { AuditLog } from "@prisma/client";
import { ROLE_LABEL } from "@/lib/auth/constants";

const ACTION_LABEL: Record<string, string> = {
  "user.role": "Зміна ролі",
  "user.flags": "Зміна прав",
  "permission.set": "Дозвіл ролі",
  "admin.create": "Створено адміністратора",
};

function describe(entry: AuditLog): string {
  try {
    const changes = JSON.parse(entry.changes ?? "{}") as Record<string, unknown>;
    const who = typeof changes.email === "string" ? `${changes.email}: ` : entry.targetType === "role" ? `${ROLE_LABEL[entry.targetId as never] ?? entry.targetId}: ` : "";
    const parts = Object.entries(changes)
      .filter(([k]) => k !== "email")
      .map(([k, v]) => {
        const d = v as { from?: unknown; to?: unknown };
        const fmt = (x: unknown) => (typeof x === "string" && x in ROLE_LABEL ? ROLE_LABEL[x as never] : String(x));
        return d && typeof d === "object" && "to" in d ? `${k}: ${fmt(d.from)} → ${fmt(d.to)}` : `${k}`;
      });
    return who + parts.join(", ");
  } catch {
    return entry.changes ?? "";
  }
}

/** Last security-relevant changes: who changed whose role / which permission. */
export default function AuditLogTable({ entries }: { entries: AuditLog[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">Змін ще не було.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Коли</th>
            <th className="px-4 py-2">Хто</th>
            <th className="px-4 py-2">Дія</th>
            <th className="px-4 py-2">Що змінено</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-t border-slate-100">
              <td className="whitespace-nowrap px-4 py-2 tabular-nums text-slate-500">
                {e.createdAt.toISOString().slice(0, 16).replace("T", " ")}
              </td>
              <td className="px-4 py-2">{e.actorEmail ?? "система"}</td>
              <td className="px-4 py-2">{ACTION_LABEL[e.action] ?? e.action}</td>
              <td className="px-4 py-2 text-slate-700">{describe(e)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
