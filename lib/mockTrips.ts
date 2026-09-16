export type TransportType = "BUS" | "FLIGHT" | "TRAIN";

export type Trip = {
  id: string;
  carrierId: string;
  carrier: string;
  carrierShort: string;
  /** Vehicle description: bus model, aircraft type or train class. */
  busType: string;
  transportType: TransportType;
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

const BUS_CARRIERS = [
  { name: "Grandes Tour", short: "GT", vehicle: "Mercedes Tourismo" },
  { name: "Asol Express", short: "AE", vehicle: "Neoplan Cityliner" },
  { name: "EuroLines Plus", short: "EL", vehicle: "Setra ComfortClass" },
  { name: "Intercity Bus", short: "IC", vehicle: "Van Hool Astromega" },
  { name: "Gunsel", short: "GS", vehicle: "Mercedes Travego" },
  { name: "FlixBus", short: "FX", vehicle: "MAN Lion's Coach" },
];

const FLIGHT_CARRIERS = [
  { name: "SkyLine Airlines", short: "SL", vehicle: "Boeing 737-800" },
  { name: "AirUkraine", short: "AU", vehicle: "Airbus A320neo" },
  { name: "EuroWings Air", short: "EW", vehicle: "Embraer E195" },
  { name: "Iberia Connect", short: "IB", vehicle: "Airbus A321" },
];

const TRAIN_CARRIERS = [
  { name: "UkrRail Express", short: "UR", vehicle: "Intercity+ Hyundai Rotem" },
  { name: "EuroRail", short: "ER", vehicle: "Siemens Velaro" },
  { name: "NightTrain Lines", short: "NT", vehicle: "Sleeper carriage" },
  { name: "RegioJet Rail", short: "RJ", vehicle: "Bombardier TRAXX" },
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

const FLIGHT_AMENITIES = ["Hand luggage", "Meal", "Wi-Fi", "USB", "Priority boarding"];
const TRAIN_AMENITIES = ["Wi-Fi", "Outlets", "WC", "Dining car", "A/C", "Bikes"];

function formatTime(minutesFromMidnight: number): string {
  const h = Math.floor(minutesFromMidnight / 60) % 24;
  const m = minutesFromMidnight % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type TripSeed = {
  depMin: number;
  duration: number;
  price: number;
  seats: number;
  rating: number;
  carrier: number;
  amen: number[];
};

function buildTrips(
  idPrefix: string,
  carrierId: string,
  carriers: { name: string; short: string; vehicle: string }[],
  transportType: TransportType,
  amenities: string[],
  seeds: TripSeed[],
  from: string,
  to: string
): Trip[] {
  return seeds.map((b, i) => {
    const carrier = carriers[b.carrier];
    return {
      id: `${idPrefix}-${i + 1}`,
      carrierId,
      carrier: carrier.name,
      carrierShort: carrier.short,
      busType: carrier.vehicle,
      transportType,
      from,
      to,
      departure: formatTime(b.depMin),
      arrival: formatTime(b.depMin + b.duration),
      durationMinutes: b.duration,
      price: b.price,
      currency: "EUR",
      seatsLeft: b.seats,
      amenities: b.amen.map((idx) => amenities[idx]),
      rating: b.rating,
    };
  });
}

export function getMockTrips(from: string, to: string): Trip[] {
  const fromCity = from?.trim() || "Kyiv";
  const toCity = to?.trim() || "Lviv";

  const base: TripSeed[] = [
    { depMin: 6 * 60 + 30, duration: 7 * 60 + 15, price: 18.5, seats: 12, rating: 4.7, carrier: 0, amen: [0, 1, 2, 3, 6] },
    { depMin: 8 * 60, duration: 6 * 60 + 50, price: 22.0, seats: 4, rating: 4.5, carrier: 1, amen: [0, 1, 2, 4] },
    { depMin: 10 * 60 + 45, duration: 8 * 60 + 10, price: 15.9, seats: 25, rating: 4.2, carrier: 2, amen: [1, 2, 3] },
    { depMin: 13 * 60 + 15, duration: 7 * 60 + 0, price: 24.9, seats: 9, rating: 4.8, carrier: 3, amen: [0, 1, 2, 3, 5, 6, 7] },
    { depMin: 17 * 60 + 30, duration: 7 * 60 + 40, price: 19.0, seats: 18, rating: 4.3, carrier: 4, amen: [0, 2, 3, 4] },
    { depMin: 22 * 60 + 0, duration: 8 * 60 + 30, price: 16.5, seats: 2, rating: 4.1, carrier: 5, amen: [0, 1, 2, 3, 7] },
  ];

  return buildTrips("mock-trip", "mock", BUS_CARRIERS, "BUS", AMENITIES_POOL, base, fromCity, toCity);
}

export function getMockFlights(from: string, to: string): Trip[] {
  const fromCity = from?.trim() || "Kyiv";
  const toCity = to?.trim() || "Madrid";

  const base: TripSeed[] = [
    { depMin: 6 * 60 + 10, duration: 3 * 60 + 40, price: 89.0, seats: 23, rating: 4.6, carrier: 0, amen: [0, 2] },
    { depMin: 9 * 60 + 25, duration: 3 * 60 + 30, price: 124.5, seats: 7, rating: 4.8, carrier: 1, amen: [0, 1, 2, 3] },
    { depMin: 13 * 60 + 50, duration: 3 * 60 + 55, price: 67.9, seats: 41, rating: 4.2, carrier: 2, amen: [0] },
    { depMin: 18 * 60 + 40, duration: 3 * 60 + 35, price: 149.0, seats: 12, rating: 4.7, carrier: 3, amen: [0, 1, 4] },
  ];

  return buildTrips("air-trip", "mock-air", FLIGHT_CARRIERS, "FLIGHT", FLIGHT_AMENITIES, base, fromCity, toCity);
}

export function getMockTrains(from: string, to: string): Trip[] {
  const fromCity = from?.trim() || "Kyiv";
  const toCity = to?.trim() || "Lviv";

  const base: TripSeed[] = [
    { depMin: 6 * 60 + 5, duration: 5 * 60 + 20, price: 14.2, seats: 56, rating: 4.5, carrier: 0, amen: [0, 1, 2, 4] },
    { depMin: 10 * 60 + 30, duration: 5 * 60 + 5, price: 21.8, seats: 34, rating: 4.6, carrier: 1, amen: [0, 1, 2, 3, 4] },
    { depMin: 16 * 60 + 45, duration: 6 * 60 + 10, price: 11.5, seats: 78, rating: 4.1, carrier: 3, amen: [1, 2, 4] },
    { depMin: 22 * 60 + 15, duration: 8 * 60 + 40, price: 27.4, seats: 18, rating: 4.4, carrier: 2, amen: [1, 2, 3, 4] },
  ];

  return buildTrips("rail-trip", "mock-rail", TRAIN_CARRIERS, "TRAIN", TRAIN_AMENITIES, base, fromCity, toCity);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
