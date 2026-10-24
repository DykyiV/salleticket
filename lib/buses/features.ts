/** Passenger-facing bus attributes, edited in Кабінет → Автобуси. */
export const BUS_CATEGORIES = ["STANDARD", "COMFORT", "VIP", "MINIBUS"] as const;
export type BusCategory = (typeof BUS_CATEGORIES)[number];

export const BUS_FEATURES = ["wifi", "sockets", "ac", "wc", "water"] as const;
export type BusFeature = (typeof BUS_FEATURES)[number];

export const BUS_CATEGORY_LABEL_UK: Record<BusCategory, string> = {
  STANDARD: "Стандарт",
  COMFORT: "Комфорт",
  VIP: "VIP / sleeper",
  MINIBUS: "Мінібус",
};

export const BUS_FEATURE_LABEL_UK: Record<BusFeature, string> = {
  wifi: "Wi-Fi",
  sockets: "Розетки",
  ac: "Кондиціонер",
  wc: "Туалет",
  water: "Вода",
};

export function isBusCategory(v: unknown): v is BusCategory {
  return typeof v === "string" && (BUS_CATEGORIES as readonly string[]).includes(v);
}

export function parseBusFeatures(raw: string | null | undefined): BusFeature[] {
  try {
    const list = JSON.parse(raw || "[]");
    return Array.isArray(list)
      ? BUS_FEATURES.filter((f) => list.includes(f))
      : [];
  } catch {
    return [];
  }
}

/** Validated update for the bus API; throws with a Ukrainian message. */
export function busFeaturesPatch(body: {
  category?: unknown;
  amenities?: unknown;
  luggagePieces?: unknown;
}): { category?: BusCategory; amenities?: string; luggagePieces?: number } {
  const out: { category?: BusCategory; amenities?: string; luggagePieces?: number } = {};
  if (body.category !== undefined) {
    if (!isBusCategory(body.category)) throw new Error("Невідомий тип автобуса");
    out.category = body.category;
  }
  if (body.amenities !== undefined) {
    if (!Array.isArray(body.amenities)) throw new Error("Послуги мають бути списком");
    out.amenities = JSON.stringify(BUS_FEATURES.filter((f) => (body.amenities as unknown[]).includes(f)));
  }
  if (body.luggagePieces !== undefined) {
    const n = Number(body.luggagePieces);
    if (!Number.isInteger(n) || n < 0 || n > 5) throw new Error("Багаж: від 0 до 5 місць");
    out.luggagePieces = n;
  }
  return out;
}

/** Services every bus of a multi-leg trip has (a transfer only promises what all buses offer). */
export function commonFeatures(lists: BusFeature[][]): BusFeature[] {
  if (!lists.length) return [];
  return BUS_FEATURES.filter((f) => lists.every((l) => l.includes(f)));
}
