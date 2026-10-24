import type { Lang } from "@/lib/i18n/config";

/** Fill {name} placeholders. */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

/** Plural forms keyed like Intl.PluralRules categories (uk: one/few/many). */
export type Plural = { one: string; few?: string; many?: string; other: string };

export function plural(lang: Lang, n: number, forms: Plural): string {
  const rule = new Intl.PluralRules(lang).select(n) as keyof Plural;
  return fmt(forms[rule] ?? forms.other, { n });
}

const LOCALE: Record<Lang, string> = { uk: "uk-UA", es: "es-ES", en: "en-GB" };

export function localeOf(lang: Lang): string {
  return LOCALE[lang];
}

/** €39.10 / 39,10 € — whole euros without decimals. */
export function money(n: number, lang: Lang, currency = "EUR"): string {
  return new Intl.NumberFormat(LOCALE[lang], {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** «пн, 3 лист.» from YYYY-MM-DD (read as a calendar day, no time zone shift). */
export function shortDate(iso: string, lang: Lang): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(LOCALE[lang], { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(d);
}

/** «вівторок, 27 жовтня 2026 р.» from a YYYY-MM-DD… string (calendar day, no zone shift). */
export function longDate(iso: string, lang: Lang, opts: { year?: boolean; weekday?: "long" | "short" } = {}): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(LOCALE[lang], {
    weekday: opts.weekday ?? "long",
    day: "numeric",
    month: "long",
    ...(opts.year === false ? {} : { year: "numeric" }),
    timeZone: "UTC",
  }).format(d);
}
