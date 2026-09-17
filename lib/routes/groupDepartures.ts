import { weekdayName } from "@/lib/routes/weekdays";
import { formatUkDate } from "@/lib/routes/dates";
import { resolveDirection, type Direction } from "@/lib/routes/countries";
import type { DepartureDTO } from "@/lib/routes/serialize";

export type DirectionGroup = Direction & {
  items: DepartureDTO[];
};

export type DayGroup = {
  date: string;
  weekday: number;
  label: string;
  directions: DirectionGroup[];
};

export function directionOf(row: DepartureDTO): Direction {
  return resolveDirection(
    {
      name: row.originCountryName,
      code: row.originCountryCode,
    },
    {
      name: row.countryName,
      code: row.countryCode,
    }
  );
}

export function groupDeparturesByDayAndDirection(
  rows: DepartureDTO[]
): DayGroup[] {
  const byDate = new Map<string, DepartureDTO[]>();
  for (const row of rows) {
    const bucket = byDate.get(row.date) ?? [];
    bucket.push(row);
    byDate.set(row.date, bucket);
  }

  return [...byDate.entries()].map(([date, items]) => {
    const byDir = new Map<string, DirectionGroup>();
    for (const item of items) {
      const dir = directionOf(item);
      const bucket = byDir.get(dir.key) ?? { ...dir, items: [] };
      bucket.items.push(item);
      byDir.set(dir.key, bucket);
    }
    const directions = [...byDir.values()].sort((a, b) =>
      a.key.localeCompare(b.key)
    );
    return {
      date,
      weekday: items[0]?.weekday ?? 0,
      label: `${weekdayName(items[0]?.weekday)} · ${formatUkDate(date)}`,
      directions,
    };
  });
}
