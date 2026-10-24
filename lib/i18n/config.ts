/** Interface languages. Ukrainian is the default and the source dictionary. */
export const LANGS = ["uk", "es", "en"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "uk";
export const LANG_COOKIE = "asol_lang";

export const LANG_LABEL: Record<Lang, { short: string; name: string; locale: string }> = {
  uk: { short: "UA", name: "Українська", locale: "uk-UA" },
  es: { short: "ES", name: "Español", locale: "es-ES" },
  en: { short: "EN", name: "English", locale: "en-GB" },
};

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}

/**
 * Language for a first visit, from the browser's Accept-Language header:
 * Spanish and English visitors get their language, everyone else Ukrainian
 * (Russian-speaking browsers included — the audience reads Ukrainian).
 */
export function langFromAcceptLanguage(header: string | null | undefined): Lang {
  if (!header) return DEFAULT_LANG;
  const tags = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number(q) || 0 : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of tags) {
    const base = tag.split("-")[0];
    if (base === "uk" || base === "ru") return "uk";
    if (base === "es" || base === "ca") return "es";
    if (base === "en") return "en";
  }
  return DEFAULT_LANG;
}
