export type Trip = {
  id: string;
  carrier: string;
  carrierShort: string;
  busType: string;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  durationMinutes: number;
  price: number;
  currency: string;
  seatsLeft: number;
  amenities: string[];
  rating: number;
};

const CARRIERS = [
  { name: "Grandes Tour", short: "GT", bus: "Mercedes Tourismo" },
  { name: "Asol Express", short: "AE", bus: "Neoplan Cityliner" },
  { name: "EuroLines Plus", short: "EL", bus: "Setra ComfortClass" },
  { name: "Intercity Bus", short: "IC", bus: "Van Hool Astromega" },
  { name: "Gunsel", short: "GS", bus: "Mercedes Travego" },
  { name: "FlixBus", short: "FX", bus: "MAN Lion's Coach" },
];

const AMENITIES_POOL = [
  "Wi-Fi",
  "USB",
  "A/C",
  "WC",
  "Snacks",
  "Movies",
  "Outlets",
  "Recliner",
];

function formatTime(minutesFromMidnight: number): string {
  const h = Math.floor(minutesFromMidnight / 60) % 24;
  const m = minutesFromMidnight % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function getMockTrips(from: string, to: string): Trip[] {
  const fromCity = from?.trim() || "Kyiv";
  const toCity = to?.trim() || "Lviv";

  const base = [
    { depMin: 6 * 60 + 30, duration: 7 * 60 + 15, price: 18.5, seats: 12, rating: 4.7, carrier: 0, amen: [0, 1, 2, 3, 6] },
    { depMin: 8 * 60, duration: 6 * 60 + 50, price: 22.0, seats: 4, rating: 4.5, carrier: 1, amen: [0, 1, 2, 4] },
    { depMin: 10 * 60 + 45, duration: 8 * 60 + 10, price: 15.9, seats: 25, rating: 4.2, carrier: 2, amen: [1, 2, 3] },
    { depMin: 13 * 60 + 15, duration: 7 * 60 + 0, price: 24.9, seats: 9, rating: 4.8, carrier: 3, amen: [0, 1, 2, 3, 5, 6, 7] },
    { depMin: 17 * 60 + 30, duration: 7 * 60 + 40, price: 19.0, seats: 18, rating: 4.3, carrier: 4, amen: [0, 2, 3, 4] },
    { depMin: 22 * 60 + 0, duration: 8 * 60 + 30, price: 16.5, seats: 2, rating: 4.1, carrier: 5, amen: [0, 1, 2, 3, 7] },
  ];

  return base.map((b, i) => {
    const carrier = CARRIERS[b.carrier];
    return {
      id: `trip-${i + 1}`,
      carrier: carrier.name,
      carrierShort: carrier.short,
      busType: carrier.bus,
      from: fromCity,
      to: toCity,
      departure: formatTime(b.depMin),
      arrival: formatTime(b.depMin + b.duration),
      durationMinutes: b.duration,
      price: b.price,
      currency: "EUR",
      seatsLeft: b.seats,
      amenities: b.amen.map((idx) => AMENITIES_POOL[idx]),
      rating: b.rating,
    };
  });
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
