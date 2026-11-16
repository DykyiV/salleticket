/**
 * The company behind kaufmann-reisen.de, as in the commercial register
 * (Handelsregister B, Amtsgericht Koblenz, HRB 10391). Used by the
 * Impressum, the privacy policy and the footer of every e-mail.
 */
export const COMPANY = {
  name: "Kaufmann GmbH",
  brand: "Kaufmann Reisen",
  street: "Bundesstraße 256 Nr. 10",
  zip: "56637",
  city: "Plaidt",
  managers: ["Vitalii Dykyi", "Viktor Kaufmann"],
  registerCourt: "Amtsgericht Koblenz",
  registerNumber: "HRB 10391",
  /** USt-IdNr. (§ 27a UStG) — shown in the Impressum once known. */
  vatId: null as string | null,
} as const;

/** One line with the details a German business e-mail must carry (§ 35a GmbHG). */
export function companyLine(): string {
  return [
    COMPANY.name,
    `${COMPANY.street}, ${COMPANY.zip} ${COMPANY.city}`,
    `${COMPANY.registerCourt} ${COMPANY.registerNumber}`,
    `Geschäftsführer: ${COMPANY.managers.join(", ")}`,
  ].join(" · ");
}
