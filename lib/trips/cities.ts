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
];

/** City name to show in the interface language (the DB stores Ukrainian). */
const CITY_LABEL: Record<string, { en: string; es: string }> = {
  Київ: { en: "Kyiv", es: "Kiev" },
  Львів: { en: "Lviv", es: "Leópolis" },
  Одеса: { en: "Odesa", es: "Odesa" },
  Харків: { en: "Kharkiv", es: "Járkov" },
  Дніпро: { en: "Dnipro", es: "Dnipró" },
  Варшава: { en: "Warsaw", es: "Varsovia" },
  Прага: { en: "Prague", es: "Praga" },
  Берлін: { en: "Berlin", es: "Berlín" },
  Марбелья: { en: "Marbella", es: "Marbella" },
  Краків: { en: "Kraków", es: "Cracovia" },
  Барселона: { en: "Barcelona", es: "Barcelona" },
  Валенсія: { en: "Valencia", es: "Valencia" },
  Мадрид: { en: "Madrid", es: "Madrid" },
  Мюнхен: { en: "Munich", es: "Múnich" },
  Франкфурт: { en: "Frankfurt", es: "Fráncfort" },
  Андернах: { en: "Andernach", es: "Andernach" },
  Париж: { en: "Paris", es: "París" },
  Мілан: { en: "Milan", es: "Milán" },
  Рим: { en: "Rome", es: "Roma" },
};

export function cityLabel(name: string, lang: "uk" | "es" | "en"): string {
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
