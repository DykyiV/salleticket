const CITY_GROUPS: string[][] = [
  ["Київ", "Kyiv", "Kiev"],
  ["Львів", "Lviv"],
  ["Одеса", "Odesa", "Odessa"],
  ["Харків", "Kharkiv"],
  ["Дніпро", "Dnipro"],
  ["Варшава", "Warsaw"],
  ["Прага", "Prague"],
  ["Берлін", "Berlin"],
  ["Марбелья", "Marbella"],
  ["Краків", "Krakow", "Kraków"],
  ["Барселона", "Barcelona"],
];

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
