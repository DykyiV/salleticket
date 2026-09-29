const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function utcDateOnly(iso: string): Date {
  const match = ISO_DATE.exec(iso.trim());
  if (!match) {
    throw new Error("Дата має бути у форматі РРРР-ММ-ДД");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Некоректна дата");
  }
  return date;
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function isoWeekdayUtc(date: Date): number {
  const js = date.getUTCDay();
  return js === 0 ? 7 : js;
}

export function listMatchingDates(
  from: Date,
  to: Date,
  weekdays: number[]
): Date[] {
  if (to.getTime() < from.getTime()) return [];
  const wanted = new Set(weekdays);
  const out: Date[] = [];
  for (
    let cursor = new Date(from.getTime());
    cursor.getTime() <= to.getTime();
    cursor = addUtcDays(cursor, 1)
  ) {
    if (wanted.has(isoWeekdayUtc(cursor))) {
      out.push(new Date(cursor.getTime()));
    }
  }
  return out;
}

export function combineUtcDateTime(
  date: Date,
  dayOffset: number,
  time: string
): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const base = addUtcDays(date, Math.max(0, dayOffset - 1));
  return new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate(),
      hours || 0,
      minutes || 0,
      0
    )
  );
}

export function todayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

export function formatUkDate(date: Date | string): string {
  const iso = typeof date === "string" ? date.slice(0, 10) : toIsoDate(date);
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
