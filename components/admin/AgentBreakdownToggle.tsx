"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

/**
 * Checkbox «розбити по агентах» for the carrier report: toggles the
 * `group=agents` query param while preserving carrier/period.
 */
export default function AgentBreakdownToggle({ checked }: { checked: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function toggle() {
    const sp = new URLSearchParams(searchParams.toString());
    if (checked) sp.delete("group");
    else sp.set("group", "agents");
    startTransition(() => {
      router.push(`/admin/reports/carrier?${sp.toString()}`);
    });
  }

  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-50 ${
        pending ? "opacity-60" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={toggle}
        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      Розбити по агентах
    </label>
  );
}
