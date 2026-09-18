/**
 * Coach seat layout (2+2, last row left pair + WC) and occupancy helpers.
 */

export type SeatStatus = "AVAILABLE" | "OCCUPIED" | "HELD";
export type SeatSide = "left" | "right";
export type SeatPosition = "window" | "aisle";

export type Seat = {
  number: number;
  row: number;
  side: SeatSide;
  position: SeatPosition;
  status: SeatStatus;
};

export type BusLayout = {
  rows: number;
  hasToilet: boolean;
  hasAssignedSeats: boolean;
  seats: Seat[];
};

export const SEAT_ROWS = 12;

export function emptySeatLayout(
  occupied: Iterable<number> = [],
  held: Iterable<number> = []
): BusLayout {
  const taken = new Set(occupied);
  const heldSet = new Set(held);
  const seats: Seat[] = [];
  let number = 1;

  for (let row = 1; row <= SEAT_ROWS; row++) {
    const isLastRow = row === SEAT_ROWS;
    const columns = isLastRow ? [0, 1] : [0, 1, 2, 3];
    for (const col of columns) {
      const side: SeatSide = col < 2 ? "left" : "right";
      const position: SeatPosition = col === 0 || col === 3 ? "window" : "aisle";
      seats.push({
        number,
        row,
        side,
        position,
        status: taken.has(number)
          ? "OCCUPIED"
          : heldSet.has(number)
            ? "HELD"
            : "AVAILABLE",
      });
      number += 1;
    }
  }

  return { rows: SEAT_ROWS, hasToilet: true, hasAssignedSeats: true, seats };
}

export function seatLabels(seat: Pick<Seat, "side" | "position">): {
  sideLabel: string;
  positionLabel: string;
} {
  return {
    sideLabel: seat.side === "left" ? "Ліва сторона" : "Права сторона",
    positionLabel: seat.position === "window" ? "Біля вікна" : "Біля проходу",
  };
}

export function findSeat(layout: BusLayout, number: number | null): Seat | null {
  if (number == null) return null;
  return layout.seats.find((s) => s.number === number) ?? null;
}

export function isValidSeatNumber(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 46;
}
