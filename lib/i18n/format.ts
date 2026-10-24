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
