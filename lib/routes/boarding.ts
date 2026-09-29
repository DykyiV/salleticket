export type BoardingStop = {
  city: string;
  addressLabel?: string | null;
  boardingAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  outboundTime?: string | null;
  returnTime?: string | null;
  isVisible?: boolean;
};

export function mapsUrl(stop: BoardingStop): string | null {
  if (stop.latitude != null && stop.longitude != null) {
    return `https://www.google.com/maps?q=${stop.latitude},${stop.longitude}`;
  }
  const query = stop.boardingAddress || stop.addressLabel;
  if (query) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
  return null;
}

export function findStopForCity(
  stops: BoardingStop[],
  city: string | null | undefined
): BoardingStop | null {
  if (!city) return null;
  const needle = city.trim().toLowerCase();
  const visible = stops.find(
    (s) => s.city.trim().toLowerCase() === needle && s.isVisible !== false
  );
  if (visible) return visible;
  return stops.find((s) => s.city.trim().toLowerCase() === needle) ?? null;
}

export function boardingLabel(stop: BoardingStop | null | undefined): string {
  if (!stop) return "";
  return stop.addressLabel || stop.boardingAddress || stop.city;
}
