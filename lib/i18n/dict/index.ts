import type { Lang } from "@/lib/i18n/config";
import uk, { type Dict } from "@/lib/i18n/dict/uk";
import es from "@/lib/i18n/dict/es";
import en from "@/lib/i18n/dict/en";

export type { Dict };
export const dictionaries: Record<Lang, Dict> = { uk, es, en };
