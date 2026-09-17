export default function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-medium text-slate-600">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-slate-400">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm text-slate-900";

export const btnPrimary =
  "rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60";

export const btnGhost =
  "rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand-300";
