"use client";

import { useLang, type Lang } from "@/lib/i18n";

export default function LanguageToggle() {
  const [lang, setLang] = useLang();
  const switchTo = (next: Lang) => setLang(next);
  return (
    <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs font-semibold">
      {(["uk", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          className={`px-2 py-1 uppercase transition ${
            lang === l
              ? "bg-brand-600 text-white"
              : "bg-white text-slate-500 hover:bg-slate-50"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
