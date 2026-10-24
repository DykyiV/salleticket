"use client";

import { LANGS, LANG_LABEL } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";

/** UA / ES / EN segmented switch. */
export default function LangSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang, switching, t } = useI18n();
  return (
    <div
      role="group"
      aria-label={t.common.language}
      className={`inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold ${switching ? "opacity-70" : ""} ${className}`}
    >
      {LANGS.map((l) => {
        const active = l === lang;
        return (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={active}
            title={LANG_LABEL[l].name}
            onClick={() => !active && setLang(l)}
            className={`min-w-[2.5rem] rounded-lg px-2.5 py-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              active ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"
            }`}
          >
            {LANG_LABEL[l].short}
          </button>
        );
      })}
    </div>
  );
}
