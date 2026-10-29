import { LANG_LABEL, type Lang } from "@/lib/i18n";

/**
 * Ticket times are wall-clock "YYYY-MM-DDTHH:MM" strings at the stop, so they
 * are formatted as a calendar day + clock time, never shifted by time zone.
 */
function day(wall: string): Date {
  return new Date(`${wall.slice(0, 10)}T12:00:00Z`);
}

export function dayNumber(wall: string): string {
  return String(Number(wall.slice(8, 10)));
}

export function monthShort(wall: string, lang: Lang): string {
  return new Intl.DateTimeFormat(LANG_LABEL[lang].locale, { month: "short", timeZone: "UTC" })
    .format(day(wall))
    .replace(".", "");
}

/** «середа, 3 листопада» */
export function longDate(wall: string, lang: Lang, weekday: "long" | "short" = "long"): string {
  return new Intl.DateTimeFormat(LANG_LABEL[lang].locale, {
    weekday,
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(day(wall));
}

export function clock(wall: string | null): string {
  return wall ? wall.slice(11, 16) : "";
}

/** «46 €» — like the site; falls back to «46 EUR» where narrow symbols are missing. */
export function money(n: number, lang: Lang, currency = "EUR"): string {
  const opts: Intl.NumberFormatOptions = {
    style: "currency",
    currency,
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  };
  try {
    return new Intl.NumberFormat(LANG_LABEL[lang].locale, { ...opts, currencyDisplay: "narrowSymbol" }).format(n);
  } catch {
    return new Intl.NumberFormat(LANG_LABEL[lang].locale, opts).format(n);
  }
}

/** Arrival: just the time on the same day, «4 лист., 06:00» on a later day. */
export function arrival(departAt: string, arriveAt: string, lang: Lang): string {
  if (arriveAt.slice(0, 10) === departAt.slice(0, 10)) return clock(arriveAt);
  const d = new Intl.DateTimeFormat(LANG_LABEL[lang].locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(day(arriveAt));
  return `${d}, ${clock(arriveAt)}`;
}
