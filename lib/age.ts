import type { AgeCategoryId } from "@/lib/pricing";

/** Parses YYYY-MM-DD as a calendar date (UTC noon, no time-zone drift). */
export function parseBirthDate(raw: unknown): Date | null {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw ? null : d;
}

/** Full years at `on` (the travel date). */
export function ageOn(birth: Date, on: Date): number {
  let age = on.getUTCFullYear() - birth.getUTCFullYear();
  const m = on.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

/** Fare category on the travel date: 0–4, 5–12, 60+, otherwise adult. */
export function ageCategoryFor(birth: Date, travelDate: Date): AgeCategoryId {
  const age = ageOn(birth, travelDate);
  if (age <= 4) return "CHILD_0_4";
  if (age <= 12) return "CHILD_5_12";
  if (age >= 60) return "SENIOR_60";
  return "ADULT";
}

/** Plausible date of birth: not in the future and at most 120 years ago. */
export function birthDateProblem(birth: Date, now = new Date()): string | null {
  if (birth.getTime() > now.getTime()) return "Дата народження не може бути в майбутньому";
  if (ageOn(birth, now) > 120) return "Перевірте дату народження";
  return null;
}
