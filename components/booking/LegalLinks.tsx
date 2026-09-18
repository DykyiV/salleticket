"use client";

import { useState } from "react";
import { LEGAL_DOCS, type LegalDocKey } from "@/lib/legal";
import { btnGhost } from "@/components/admin/Field";

const LINKS: { key: LegalDocKey; label: string }[] = [
  { key: "baggage", label: "Правила багажу" },
  { key: "rights", label: "Права пасажира" },
  { key: "offer", label: "Договір оферти" },
];

export default function LegalLinks({ className }: { className?: string }) {
  const [open, setOpen] = useState<LegalDocKey | null>(null);
  const doc = open ? LEGAL_DOCS[open] : null;

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {LINKS.map((link) => (
          <button
            key={link.key}
            type="button"
            onClick={() => setOpen(link.key)}
            className="text-xs text-brand-700 underline decoration-dotted underline-offset-2 hover:text-brand-800"
          >
            {link.label}
          </button>
        ))}
      </div>

      {doc ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">
                {doc.title}
              </h2>
              <button type="button" className={btnGhost} onClick={() => setOpen(null)}>
                Закрити
              </button>
            </div>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
              {doc.body.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
