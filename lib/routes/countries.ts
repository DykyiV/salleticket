const SHORT_BY_CODE: Record<string, string> = {
  UA: "Укр",
  DE: "Нім",
  ES: "Ісп",
  PL: "Пол",
  IT: "Іт",
  FR: "Фр",
  CZ: "Чех",
  SK: "Слв",
  AT: "Авс",
  NL: "Нід",
  BE: "Бел",
  PT: "Пор",
  RO: "Рум",
  HU: "Угр",
  MD: "Мол",
  GB: "Бр",
  LT: "Лит",
  LV: "Лат",
  EE: "Ест",
};

const CODE_BY_NAME: Record<string, string> = {
  Україна: "UA",
  Німеччина: "DE",
  Іспанія: "ES",
  Польща: "PL",
  Італія: "IT",
  Франція: "FR",
  Чехія: "CZ",
  Словаччина: "SK",
  Австрія: "AT",
  Нідерланди: "NL",
  Бельгія: "BE",
  Португалія: "PT",
  Румунія: "RO",
  Угорщина: "HU",
  Молдова: "MD",
};

export type CountryRef = {
  id?: string;
  name: string;
  code: string | null;
};

export type Direction = {
  key: string;
  originCode: string;
  originName: string;
  originShort: string;
  destinationCode: string;
  destinationName: string;
  destinationShort: string;
};

export function countryCode(country: CountryRef | null | undefined): string {
  if (!country) return "";
  const fromField = country.code?.trim().toUpperCase();
  if (fromField && fromField.length === 2) return fromField;
  return CODE_BY_NAME[country.name] ?? "";
}

export function countryShort(code: string, fallbackName = ""): string {
  if (SHORT_BY_CODE[code]) return SHORT_BY_CODE[code];
  if (fallbackName.length <= 4) return fallbackName || code || "—";
  return fallbackName.slice(0, 3);
}

export function flagEmoji(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "🏳️";
  return String.fromCodePoint(
    ...[...code].map((ch) => 127397 + ch.charCodeAt(0))
  );
}

export function resolveDirection(
  origin: CountryRef | null | undefined,
  destination: CountryRef
): Direction {
  const destCode = countryCode(destination);
  const originCode =
    countryCode(origin) || (destCode !== "UA" ? "UA" : destCode);
  const originName = origin?.name || (originCode === "UA" ? "Україна" : originCode);
  return {
    key: `${originCode || "XX"}-${destCode || "XX"}`,
    originCode,
    originName,
    originShort: countryShort(originCode, originName),
    destinationCode: destCode,
    destinationName: destination.name,
    destinationShort: countryShort(destCode, destination.name),
  };
}
