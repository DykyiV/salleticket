import type { Lang } from "@/lib/i18n/config";
import uk, { type Dict } from "@/lib/i18n/dict/uk";
import es from "@/lib/i18n/dict/es";
import en from "@/lib/i18n/dict/en";
import de from "@/lib/i18n/dict/de";

export type { Dict };
export const dictionaries: Record<Lang, Dict> = { uk, de, es, en };
