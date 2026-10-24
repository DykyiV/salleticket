"use client";

import { createContext, useCallback, useContext, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LANG_COOKIE, type Lang } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dict";

type I18n = { lang: Lang; t: Dict; setLang: (lang: Lang) => void; switching: boolean };

const I18nContext = createContext<I18n | null>(null);

/**
 * Seeded on the server with the request's language and dictionary, so the
 * first paint is already in the right language. Switching stores the choice
 * in a cookie and re-renders the server components.
 */
export function LangProvider({ lang, t, children }: { lang: Lang; t: Dict; children: ReactNode }) {
  const router = useRouter();
  const [switching, startTransition] = useTransition();
  const setLang = useCallback(
    (next: Lang) => {
      document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      document.documentElement.lang = next;
      startTransition(() => router.refresh());
    },
    [router]
  );
  return <I18nContext.Provider value={{ lang, t, setLang, switching }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n() outside <LangProvider>");
  return ctx;
}

export { fmt, plural } from "@/lib/i18n/format";
