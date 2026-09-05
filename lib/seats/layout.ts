/**
 * Pure seat-numbering math shared by:
 *   - lib/routes/generate.ts, which creates the real `Seat` rows for a Trip
 *     generated from a Route template (1..route.busCapacity)
 *   - lib/seats.ts, which maps those rows (or a deterministic mock, for
 *     trips that don't come from a Route template) into the `BusLayout`
 *     shape `components/SeatMap.tsx` renders.
 *
 * Layout: 2 seats left of the aisle, 2 right (window/aisle each side), one
 * bus-length row of 4 at a time. If `capacity` isn't a multiple of 4 the
 * last row is partial (filled left-to-right) rather than padded.
 */

export type SeatSide = "left" | "right";
export type SeatPosition = "window" | "aisle";

export type SeatSlot = {
  number: number;
  row: number;
  side: SeatSide;
  position: SeatPosition;
};

const COLUMNS: { side: SeatSide; position: SeatPosition }[] = [
  { side: "left", position: "window" },
  { side: "left", position: "aisle" },
  { side: "right", position: "aisle" },
  { side: "right", position: "window" },
];

/** Generate `capacity` seat slots (number, row, side, position), 4 per row. */
export function buildSeatSlots(capacity: number): SeatSlot[] {
  const slots: SeatSlot[] = [];
  let number = 1;
  let row = 1;
  while (number <= capacity) {
    for (const col of COLUMNS) {
      if (number > capacity) break;
      slots.push({ number, row, side: col.side, position: col.position });
      number++;
    }
    row++;
  }
  return slots;
}

export function rowCountFor(capacity: number): number {
  return Math.max(1, Math.ceil(capacity / COLUMNS.length));
}
