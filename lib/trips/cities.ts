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

export function cityLabel(name: string, lang: "uk" | "de" | "es" | "en"): string {
  const group = cityNames(name);
  const uk = group[0] ?? name;
  if (lang === "uk") return CITY_LABEL[uk] ? uk : name;
  return CITY_LABEL[uk]?.[lang] ?? name;
}

/** Ukrainian names of all known cities (for the search suggestions). */
export function knownCities(): string[] {
  return CITY_GROUPS.map((group) => group[0]);
}

/** All known spellings of a city so search/booking match Prisma rows. */
export function cityNames(input: string): string[] {
  const raw = input.trim();
  if (!raw) return [];
  const key = raw.toLowerCase();
  for (const group of CITY_GROUPS) {
    if (group.some((name) => name.toLowerCase() === key)) return group;
  }
  return [raw];
}
