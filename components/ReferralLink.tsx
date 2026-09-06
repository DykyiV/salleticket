"use client";

import { useEffect, useState } from "react";

export default function ReferralLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState(`/register?ref=${code}`);

  // Absolute URL is nicer to share, but only known client-side.
  useEffect(() => {
    setLink(`${window.location.origin}/register?ref=${code}`);
  }, [code]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — the field is still selectable manually.
    }
  };

  return (
    <div className="mt-3 flex items-center gap-2">
      <input
        type="text"
        readOnly
        value={link}
        onFocus={(e) => e.currentTarget.select()}
        className="h-10 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700"
      />
      <button
        type="button"
        onClick={copy}
        className="h-10 shrink-0 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        {copied ? "Скопійовано!" : "Копіювати"}
      </button>
    </div>
  );
}
