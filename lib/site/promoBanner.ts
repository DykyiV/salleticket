/**
 * Grandes Tour's Black Friday 2026: −20 % with the code BF20, 23–30.11
 * (https://grandes-tour.com.ua/news/54). The code is GT's own discount card;
 * on this site it applies to trips up to the last day, because the ticket is
 * paid when boarding (lib/carriers/grandes-tour/pricing.ts, gtCheckCard).
 * The banner shows itself only on those days.
 */
export const BLACK_FRIDAY = { code: "BF20", from: "2026-11-23", until: "2026-11-30" } as const;

/** The promo to show on `today` (YYYY-MM-DD, Central European time), or null. */
export function activePromo(today: string): typeof BLACK_FRIDAY | null {
  return today >= BLACK_FRIDAY.from && today <= BLACK_FRIDAY.until ? BLACK_FRIDAY : null;
}
