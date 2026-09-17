"use client";

export default function PrintTicketButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white print:hidden"
    >
      Друкувати
    </button>
  );
}
