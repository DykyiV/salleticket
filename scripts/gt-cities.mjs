// Regenerates lib/trips/gtCities.ts from the Grandes Tour city directory.
// Usage: GRANDES_TOUR_API_KEY=… node scripts/gt-cities.mjs > lib/trips/gtCities.ts
const key = process.env.GRANDES_TOUR_API_KEY;
if (!key) throw new Error("GRANDES_TOUR_API_KEY is not set");
const langs = ["uk", "en", "es", "de", "pl"];
const byId = {};
for (const lang of langs) {
  const res = await fetch("https://grandes-tour.com.ua/api/v3/cache/cities", {
    headers: { "Api-Key": key, "Accept-Language": lang },
  });
  for (const c of (await res.json()).cities) {
    byId[c.id] ??= { country: c.country_iso };
    byId[c.id][lang] = c.name.trim();
  }
}
const rows = Object.values(byId)
  .filter((r) => r.uk)
  .sort((a, b) => a.country.localeCompare(b.country) || a.uk.localeCompare(b.uk, "uk"));
const q = (s) => JSON.stringify(s || "");
let out = `/**
 * Grandes Tour city directory (snapshot of /api/v3/cache/cities in uk/en/es/de/pl,
 * ${new Date().toISOString().slice(0, 10)}). Lets the search understand a city typed in any of
 * these languages and show it in the site language. Regenerate: scripts/gt-cities.mjs.
 */
export const GT_CITIES: readonly (readonly [country: string, uk: string, en: string, es: string, de: string, pl: string])[] = [
`;
for (const r of rows) out += `  [${[r.country, r.uk, r.en, r.es, r.de, r.pl].map(q).join(", ")}],\n`;
out += "];\n";
process.stdout.write(out);
