/**
 * Extra-baggage rules differ by direction (Grandes Tour): Spanish routes
 * charge 2 €/kg, German routes 1 €/kg, paid at boarding.
 */
export type BaggageZone = "ES" | "DE";

export const EXTRA_BAGGAGE_RATE: Record<BaggageZone, number> = { ES: 2, DE: 1 };

const ES_ISO = new Set(["ES", "ESP"]);
const DE_ISO = new Set(["DE", "DEU"]);

export function zoneFromCountries(isos: (string | null | undefined)[]): BaggageZone | null {
  const up = isos.map((c) => (c ?? "").trim().toUpperCase());
  if (up.some((c) => ES_ISO.has(c))) return "ES";
  if (up.some((c) => DE_ISO.has(c))) return "DE";
  return null;
}

const ES_CITIES = ["Марбелья", "Барселона", "Валенсія", "Мадрид", "Севілья", "Ов'єдо", "Куенка"];
const DE_CITIES = ["Берлін", "Мюнхен", "Франкфурт", "Андернах", "Білефельд"];

/** Fallback by known city names (Ukrainian, as stored). */
export function zoneFromNames(from: string, to: string): BaggageZone | null {
  const names = [from, to].map((n) => n.trim());
  if (names.some((n) => ES_CITIES.includes(n))) return "ES";
  if (names.some((n) => DE_CITIES.includes(n))) return "DE";
  return null;
}
