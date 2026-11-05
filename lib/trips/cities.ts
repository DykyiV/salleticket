import { GT_CITIES } from "@/lib/trips/gtCities";

const CITY_GROUPS: string[][] = [
  ["Київ", "Kyiv", "Kiev"],
  ["Львів", "Lviv", "Leópolis"],
  ["Одеса", "Odesa", "Odessa"],
  ["Харків", "Kharkiv", "Járkov"],
  ["Дніпро", "Dnipro", "Dnipró"],
  ["Варшава", "Warsaw", "Varsovia", "Warszawa"],
  ["Прага", "Prague", "Praga"],
  ["Берлін", "Berlin", "Berlín"],
  ["Марбелья", "Marbella"],
  ["Краків", "Krakow", "Kraków", "Cracovia"],
  ["Барселона", "Barcelona"],
  ["Валенсія", "Valencia", "València"],
  ["Мадрид", "Madrid"],
  ["Мюнхен", "Munich", "Múnich", "München"],
  ["Франкфурт", "Frankfurt", "Fráncfort"],
  ["Андернах", "Andernach"],
  ["Париж", "Paris", "París"],
  ["Мілан", "Milan", "Milán", "Milano"],
  ["Рим", "Rome", "Roma"],
  ["Севілья", "Seville", "Sevilla"],
  ["Білефельд", "Bielefeld"],
  ["Ов'єдо", "Oviedo"],
  ["Куенка", "Cuenca"],
  ["Тернопіль", "Ternopil", "Ternópil"],
];

/** City name to show in the interface language (the DB stores Ukrainian). */
const CITY_LABEL: Record<string, { en: string; es: string; de: string }> = {
  Київ: { en: "Kyiv", es: "Kiev", de: "Kiew" },
  Львів: { en: "Lviv", es: "Leópolis", de: "Lwiw" },
  Одеса: { en: "Odesa", es: "Odesa", de: "Odessa" },
  Харків: { en: "Kharkiv", es: "Járkov", de: "Charkiw" },
  Дніпро: { en: "Dnipro", es: "Dnipró", de: "Dnipro" },
  Варшава: { en: "Warsaw", es: "Varsovia", de: "Warschau" },
  Прага: { en: "Prague", es: "Praga", de: "Prag" },
  Берлін: { en: "Berlin", es: "Berlín", de: "Berlin" },
  Марбелья: { en: "Marbella", es: "Marbella", de: "Marbella" },
  Краків: { en: "Kraków", es: "Cracovia", de: "Krakau" },
  Барселона: { en: "Barcelona", es: "Barcelona", de: "Barcelona" },
  Валенсія: { en: "Valencia", es: "Valencia", de: "Valencia" },
  Мадрид: { en: "Madrid", es: "Madrid", de: "Madrid" },
  Мюнхен: { en: "Munich", es: "Múnich", de: "München" },
  Франкфурт: { en: "Frankfurt", es: "Fráncfort", de: "Frankfurt" },
  Андернах: { en: "Andernach", es: "Andernach", de: "Andernach" },
  Париж: { en: "Paris", es: "París", de: "Paris" },
  Мілан: { en: "Milan", es: "Milán", de: "Mailand" },
  Рим: { en: "Rome", es: "Roma", de: "Rom" },
  Севілья: { en: "Seville", es: "Sevilla", de: "Sevilla" },
  Білефельд: { en: "Bielefeld", es: "Bielefeld", de: "Bielefeld" },
  "Ов'єдо": { en: "Oviedo", es: "Oviedo", de: "Oviedo" },
  Куенка: { en: "Cuenca", es: "Cuenca", de: "Cuenca" },
  Тернопіль: { en: "Ternopil", es: "Ternópil", de: "Ternopil" },
};

/** Comparable form of a city name: lower case, no accents/apostrophes. */
export function normCity(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'ʼ`´]/g, "")
    .replace(/[-\s]+/g, " ")
    .trim()
    .toLowerCase();
}

/** `served` — on a current Grandes Tour route (only these are suggested). */
type CityEntry = { uk: string; labels: { en: string; es: string; de: string }; names: string[]; served: boolean };

/**
 * Every city we know (our list + the Grandes Tour directory), with all its
 * spellings, so a city typed in any language finds the same city.
 */
const { ENTRIES, BY_NAME } = (() => {
  const entries: CityEntry[] = [];
  const byName = new Map<string, CityEntry>();
  const add = (entry: CityEntry, names: string[]) => {
    for (const n of names) {
      if (!n) continue;
      if (!entry.names.includes(n)) entry.names.push(n);
      const key = normCity(n);
      if (!byName.has(key)) byName.set(key, entry);
    }
  };
  for (const group of CITY_GROUPS) {
    const uk = group[0];
    const entry: CityEntry = { uk, labels: CITY_LABEL[uk] ?? { en: uk, es: uk, de: uk }, names: [], served: false };
    entries.push(entry);
    add(entry, group);
  }
  for (const [, uk, en, es, de, pl, served] of GT_CITIES) {
    const names = [uk, en, es, de, pl];
    let entry = names.map((n) => byName.get(normCity(n))).find(Boolean);
    if (!entry) {
      entry = { uk, labels: { en: en || uk, es: es || uk, de: de || uk }, names: [], served: false };
      entries.push(entry);
    }
    if (served) entry.served = true;
    add(entry, names);
  }
  return { ENTRIES: entries, BY_NAME: byName };
})();

export function cityLabel(name: string, lang: "uk" | "de" | "es" | "en"): string {
  const entry = BY_NAME.get(normCity(name));
  if (!entry) return name;
  return lang === "uk" ? entry.uk : entry.labels[lang] || entry.uk;
}

/** All known spellings of a city (Ukrainian first) so search/booking match. */
export function cityNames(input: string): string[] {
  const raw = input.trim();
  if (!raw) return [];
  return BY_NAME.get(normCity(raw))?.names ?? [raw];
}

export type CitySuggestion = { uk: string; label: string; alt: string | null };

/**
 * Cities for what the user is typing, in any language: the label is in the
 * site language, `alt` is the spelling that matched when it differs.
 */
export function citySuggestions(query: string, lang: "uk" | "de" | "es" | "en", limit = 8): CitySuggestion[] {
  const q = normCity(query);
  if (!q) return [];
  const hits: { entry: CityEntry; rank: number; matched: string }[] = [];
  for (const entry of ENTRIES) {
    if (!entry.served) continue;
    let rank = -1;
    let matched = "";
    for (const n of entry.names) {
      const nn = normCity(n);
      const r = nn.startsWith(q) ? 0 : nn.includes(` ${q}`) ? 1 : -1;
      if (r >= 0 && (rank < 0 || r < rank)) {
        rank = r;
        matched = n;
      }
    }
    if (rank >= 0) hits.push({ entry, rank, matched });
  }
  return hits
    .map(({ entry, rank, matched }) => ({ rank, label: cityLabel(entry.uk, lang), uk: entry.uk, matched }))
    .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map(({ uk, label, matched }) => ({ uk, label, alt: normCity(matched) === normCity(label) ? null : matched }));
}
