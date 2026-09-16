/**
 * City → country mapping used to backfill Trip.fromCountry / toCountry and
 * to power the country filter on the departures page. Unknown cities map to
 * an empty string; extend as new routes appear (later this becomes the
 * "Довідник → міста і країни" directory).
 */
export const CITY_COUNTRY: Record<string, string> = {
  // Ukraine
  Kyiv: "Ukraine",
  Lviv: "Ukraine",
  Odesa: "Ukraine",
  Kharkiv: "Ukraine",
  Dnipro: "Ukraine",
  // Spain
  Madrid: "Spain",
  Barcelona: "Spain",
  Valencia: "Spain",
  Seville: "Spain",
  // Poland
  Warsaw: "Poland",
  Krakow: "Poland",
  Wroclaw: "Poland",
  Gdansk: "Poland",
  // Germany
  Berlin: "Germany",
  Munich: "Germany",
  Hamburg: "Germany",
  Frankfurt: "Germany",
  // Czechia / Austria / Slovakia / Hungary
  Prague: "Czechia",
  Brno: "Czechia",
  Vienna: "Austria",
  Bratislava: "Slovakia",
  Budapest: "Hungary",
  // France / Italy / Portugal / UK / Netherlands
  Paris: "France",
  Lyon: "France",
  Rome: "Italy",
  Milan: "Italy",
  Lisbon: "Portugal",
  Porto: "Portugal",
  London: "United Kingdom",
  Amsterdam: "Netherlands",
};

export function countryForCity(city: string): string {
  return CITY_COUNTRY[city] ?? "";
}
