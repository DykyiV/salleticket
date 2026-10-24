import uk from "@/lib/i18n/dict/uk";

/** Ukrainian legal texts (single source: lib/i18n/dict/uk.ts → legal). */
export const LEGAL_DOCS = uk.legal;

export type LegalDocKey = keyof typeof LEGAL_DOCS;
