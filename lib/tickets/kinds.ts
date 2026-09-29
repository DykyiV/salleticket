export const TRIP_KIND_IDS = ["ONE_WAY", "ROUND_TRIP", "OPEN_RETURN"] as const;

export type TripKindId = (typeof TRIP_KIND_IDS)[number];

export const TRIP_KIND_OPTIONS: ReadonlyArray<{
  id: TripKindId;
  label: string;
  hint: string;
}> = [
  {
    id: "ONE_WAY",
    label: "В одну сторону",
    hint: "Лише виїзд туди",
  },
  {
    id: "ROUND_TRIP",
    label: "В дві сторони з визначеною датою",
    hint: "Туди й назад із датою повернення",
  },
  {
    id: "OPEN_RETURN",
    label: "В дві сторони з відкритою датою повернення",
    hint: "Дату назад оберете пізніше в квитку",
  },
];

export function parseTripKind(raw?: string | null): TripKindId {
  if (raw === "ROUND_TRIP" || raw === "OPEN_RETURN") return raw;
  return "ONE_WAY";
}
