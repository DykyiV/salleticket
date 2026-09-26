/**
 * Bus seat map.
 *
 * This mirrors the pattern used by `lib/carriers/*` for trip search: a plain
 * data function returning a typed shape, so the UI (`components/SeatMap.tsx`)
 * never needs to change when the mock generator below is swapped for a real
 * seat-inventory source (e.g. `GET /api/trips/:tripId/seats`, or a `Seat`
 * table keyed by tripId once one exists in `prisma/schema.prisma`).
 *
 * `SeatStatus` intentionally has only the two values a real inventory system
 * would track — AVAILABLE / OCCUPIED. "SELECTED" is a purely client-side UI
 * state (which seat the current visitor has tapped) and is layered on top by
 * the seat map component; it's never part of the underlying data.
 */

export type SeatStatus = "AVAILABLE" | "OCCUPIED";
export type SeatSide = "left" | "right";
export type SeatPosition = "window" | "aisle";

export type Seat = {
  /** Passenger-facing seat number: 1, 2, 3, ... in front-to-back, left-to-right order. */
  number: number;
  row: number;
  side: SeatSide;
  position: SeatPosition;
  status: SeatStatus;
};

export type BusLayout = {
  rows: number;
  hasToilet: boolean;
  seats: Seat[];
};

const ROWS = 12;
/** Fraction of seats that come back pre-occupied in the mock layout. */
const MOCK_OCCUPANCY_RATE = 0.28;

/**
 * Returns the seat map for a given trip.
 *
 * MOCK IMPLEMENTATION: occupancy is derived deterministically from `tripId`
 * (via a simple string hash + seeded pseudo-random value per seat) so the
 * same trip always renders the same taken seats across reloads, with no
 * network round-trip. Replace the body of this function with a real fetch
 * once seat inventory is tracked server-side — every caller only depends on
 * the `BusLayout` / `Seat` shapes above, not on how they were produced.
 */
export function getSeatLayout(tripId: string): BusLayout {
  const seed = hashString(tripId || "default-trip");
  const seats: Seat[] = [];
  let number = 1;

  for (let row = 1; row <= ROWS; row++) {
    const isLastRow = row === ROWS;
    // Column layout per row: 0-1 = left pair (window, aisle),
    // 2-3 = right pair (aisle, window). The last row's right side is
    // reserved for the onboard toilet instead of seats.
    const columns = isLastRow ? [0, 1] : [0, 1, 2, 3];
    for (const col of columns) {
      const side: SeatSide = col < 2 ? "left" : "right";
      const position: SeatPosition = col === 0 || col === 3 ? "window" : "aisle";
      const occupied = pseudoRandom(seed, number) < MOCK_OCCUPANCY_RATE;
      seats.push({
        number,
        row,
        side,
        position,
        status: occupied ? "OCCUPIED" : "AVAILABLE",
      });
      number++;
    }
  }

  return { rows: ROWS, hasToilet: true, seats };
}

/** Ukrainian side/position labels for the seat info panel (auto-derived from the layout). */
export function seatLabels(seat: Pick<Seat, "side" | "position">): {
  sideLabel: string;
  positionLabel: string;
} {
  return {
    sideLabel: seat.side === "left" ? "Ліва сторона" : "Права сторона",
    positionLabel: seat.position === "window" ? "Біля вікна" : "Біля проходу",
  };
}

/** The subset of a Seat the booking flow needs once one has been picked. */
export type SelectedSeat = Pick<Seat, "number" | "side" | "position">;

export function findSeat(layout: BusLayout, number: number | null): Seat | null {
  if (number == null) return null;
  return layout.seats.find((s) => s.number === number) ?? null;
}

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic 0..1 pseudo-random value derived from a seed + index. */
function pseudoRandom(seed: number, n: number): number {
  const x = Math.sin(seed + n * 9973) * 10000;
  return x - Math.floor(x);
}
