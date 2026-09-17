export type Weekday = {
  id: number;
  short: string;
  full: string;
};

/** ISO weekdays: 1 = Monday … 7 = Sunday. */
export const WEEKDAYS: Weekday[] = [
  { id: 1, short: "Пн", full: "Понеділок" },
  { id: 2, short: "Вт", full: "Вівторок" },
  { id: 3, short: "Ср", full: "Середа" },
  { id: 4, short: "Чт", full: "Четвер" },
  { id: 5, short: "Пт", full: "Пʼятниця" },
  { id: 6, short: "Сб", full: "Субота" },
  { id: 7, short: "Нд", full: "Неділя" },
];

export function weekdayName(id: number | null | undefined): string {
  if (id == null) return "—";
  return WEEKDAYS.find((w) => w.id === id)?.full ?? "—";
}

export function weekdayShort(id: number | null | undefined): string {
  if (id == null) return "—";
  return WEEKDAYS.find((w) => w.id === id)?.short ?? "—";
}

export function parseWeekdays(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return [
      ...new Set(
        value
          .map((n) => Number(n))
          .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
      ),
    ].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export function stringifyWeekdays(days: number[]): string {
  return JSON.stringify(
    [...new Set(days.filter((n) => Number.isInteger(n) && n >= 1 && n <= 7))].sort(
      (a, b) => a - b
    )
  );
}

export function formatWeekdays(days: number[]): string {
  if (!days.length) return "—";
  return days.map((d) => weekdayShort(d)).join(", ");
}
