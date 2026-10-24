import { describe, expect, it } from "vitest";
import { langFromAcceptLanguage } from "@/lib/i18n/config";
import { fmt, plural } from "@/lib/i18n/format";
import { dictionaries } from "@/lib/i18n/dict";
import { cityLabel, cityNames } from "@/lib/trips/cities";

function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object" && "one" in value && "other" in value) return "plural";
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, shape((value as Record<string, unknown>)[k])]));
  }
  return typeof value;
}

describe("dictionaries", () => {
  it("Spanish and English have exactly the Ukrainian structure (same keys, same list lengths)", () => {
    const uk = shape(dictionaries.uk);
    expect(shape(dictionaries.es)).toEqual(uk);
    expect(shape(dictionaries.en)).toEqual(uk);
  });

  it("no empty strings", () => {
    const empty: string[] = [];
    const walk = (v: unknown, path: string) => {
      if (typeof v === "string") {
        if (!v.trim()) empty.push(path);
      } else if (v && typeof v === "object") {
        for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
      }
    };
    for (const [lang, d] of Object.entries(dictionaries)) walk(d, lang);
    expect(empty).toEqual([]);
  });
});

describe("language detection", () => {
  it("picks the visitor's browser language", () => {
    expect(langFromAcceptLanguage("es-ES,es;q=0.9,en;q=0.8")).toBe("es");
    expect(langFromAcceptLanguage("ca-ES,ca;q=0.9")).toBe("es");
    expect(langFromAcceptLanguage("en-GB,en;q=0.9")).toBe("en");
    expect(langFromAcceptLanguage("de-DE,de;q=0.9,en;q=0.5")).toBe("en");
    expect(langFromAcceptLanguage("ru-RU,ru;q=0.9")).toBe("uk");
    expect(langFromAcceptLanguage("pl-PL")).toBe("uk");
    expect(langFromAcceptLanguage(null)).toBe("uk");
  });
});

describe("formatting", () => {
  it("fills placeholders and picks Ukrainian plural forms", () => {
    expect(fmt("≈ {h} год", { h: 23 })).toBe("≈ 23 год");
    const forms = dictionaries.uk.search.passengersCount;
    expect(plural("uk", 1, forms)).toBe("1 пасажир");
    expect(plural("uk", 3, forms)).toBe("3 пасажири");
    expect(plural("uk", 5, forms)).toBe("5 пасажирів");
    expect(plural("es", 2, dictionaries.es.search.passengersCount)).toBe("2 pasajeros");
    expect(plural("en", 1, dictionaries.en.search.passengersCount)).toBe("1 passenger");
  });
});

describe("city names", () => {
  it("shows cities in the interface language and matches every spelling", () => {
    expect(cityLabel("Варшава", "es")).toBe("Varsovia");
    expect(cityLabel("Київ", "en")).toBe("Kyiv");
    expect(cityLabel("Kyiv", "uk")).toBe("Київ");
    expect(cityLabel("Невідоме", "en")).toBe("Невідоме");
    expect(cityNames("Varsovia")).toContain("Варшава");
    expect(cityNames("valencia")).toContain("Валенсія");
  });
});
