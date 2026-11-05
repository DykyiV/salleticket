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
// Cities on the current GT routes (stops of every route schedule) are where
// buses really go — only these are offered in the search; the rest of the
// directory are border crossings and old points.
const head = { "Api-Key": key, "Accept-Language": "uk", "Content-Type": "application/json" };
const routes = (await (await fetch("https://grandes-tour.com.ua/api/v3/cache/routes", { headers: head })).json()).routes;
const servedIds = new Set();
for (const r of routes) {
  const res = await fetch("https://grandes-tour.com.ua/api/v2/references/route_details", {
    method: "POST",
    headers: head,
    body: JSON.stringify({ id: r.id }),
  });
  for (const sch of (await res.json()).schedules ?? []) for (const it of sch.items ?? []) servedIds.add(it.city_id);
}
if (!servedIds.size) throw new Error("No cities found on GT routes");
for (const [id, r] of Object.entries(byId)) r.served = servedIds.has(Number(id));
const rows = Object.values(byId)
  .filter((r) => r.uk)
  .sort((a, b) => a.country.localeCompare(b.country) || a.uk.localeCompare(b.uk, "uk"));
const q = (s) => JSON.stringify(s || "");
let out = `/**
 * Grandes Tour city directory (snapshot of /api/v3/cache/cities in uk/en/es/de/pl,
 * ${new Date().toISOString().slice(0, 10)}). Lets the search understand a city typed in any of
 * these languages and show it in the site language. \`served\` — the city has an active
 * GT stop (only those are suggested in the search). Regenerate: scripts/gt-cities.mjs.
 */
export const GT_CITIES: readonly (readonly [country: string, uk: string, en: string, es: string, de: string, pl: string, served: boolean])[] = [
`;
for (const r of rows) out += `  [${[r.country, r.uk, r.en, r.es, r.de, r.pl].map(q).join(", ")}, ${r.served}],\n`;
out += "];\n";
process.stdout.write(out);
