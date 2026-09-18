/**
 * Coach seat layouts (FUTABUS-style): decks with cell grids. A cell is a
 * seat (with number, kind, price multiplier) or a fixture (WC, door,
 * stairs, empty). The default coach is 2+2, 12 rows, WC in the last row.
 */

export type SeatStatus = "AVAILABLE" | "OCCUPIED" | "HELD";
export type SeatKind = "seat" | "semi_sleeper" | "sleeper";
export type CellType = "seat" | "empty" | "wc" | "door" | "stairs";

export type Seat = {
  number: number;
  deck: number;
  row: number;
  col: number;
  kind: SeatKind;
  /** Price multiplier for this seat (1 = base fare). */
  mult: number;
  status: SeatStatus;
};

export type LayoutCell =
  | { type: "seat"; seat: Seat }
  | { type: Exclude<CellType, "seat"> };

export type DeckView = { name: string; rows: LayoutCell[][] };

export type BusLayout = {
  hasAssignedSeats: boolean;
  decks: DeckView[];
  seatCount: number;
  seats: Seat[];
};

/** Serialized form stored on Bus.layout. */
export type CoachCellJSON = {
  t: CellType;
  kind?: SeatKind;
  mult?: number;
};
export type CoachLayoutJSON = { decks: { name: string; rows: CoachCellJSON[][] }[] };

export const SEAT_ROWS = 12;

export function defaultCoachLayoutJSON(): CoachLayoutJSON {
  const rows: CoachCellJSON[][] = [];
  for (let row = 1; row <= SEAT_ROWS; row += 1) {
    if (row === SEAT_ROWS) {
      rows.push([{ t: "seat" }, { t: "seat" }, { t: "wc" }, { t: "empty" }]);
    } else {
      rows.push([{ t: "seat" }, { t: "seat" }, { t: "seat" }, { t: "seat" }]);
    }
  }
  return { decks: [{ name: "Салон", rows }] };
}

export function parseCoachLayout(raw: string | null | undefined): CoachLayoutJSON {
  if (!raw) return defaultCoachLayoutJSON();
  try {
    const parsed = JSON.parse(raw) as CoachLayoutJSON;
    if (!parsed || !Array.isArray(parsed.decks) || !parsed.decks.length) {
      return defaultCoachLayoutJSON();
    }
    return parsed;
  } catch {
    return defaultCoachLayoutJSON();
  }
}

export function buildLayout(
  json: CoachLayoutJSON,
  occupied: Iterable<number> = [],
  held: Iterable<number> = []
): BusLayout {
  const taken = new Set(occupied);
  const heldSet = new Set(held);
  const seats: Seat[] = [];
  const decks: DeckView[] = [];
  let number = 1;

  json.decks.forEach((deck, deckIndex) => {
    const rows: LayoutCell[][] = deck.rows.map((row, rowIndex) =>
      row.map((cell, colIndex) => {
        if (cell.t !== "seat") return { type: cell.t } as LayoutCell;
        const seat: Seat = {
          number,
          deck: deckIndex,
          row: rowIndex + 1,
          col: colIndex,
          kind: cell.kind ?? "seat",
          mult: cell.mult && cell.mult > 0 ? cell.mult : 1,
          status: taken.has(number)
            ? "OCCUPIED"
            : heldSet.has(number)
              ? "HELD"
              : "AVAILABLE",
        };
        seats.push(seat);
        number += 1;
        return { type: "seat", seat } as LayoutCell;
      })
    );
    decks.push({ name: deck.name, rows });
  });

  return { hasAssignedSeats: true, decks, seatCount: seats.length, seats };
}

/** Backwards-compatible helper: default coach with statuses. */
export function emptySeatLayout(
  occupied: Iterable<number> = [],
  held: Iterable<number> = []
): BusLayout {
  return buildLayout(defaultCoachLayoutJSON(), occupied, held);
}

export function seatLabels(seat: Pick<Seat, "col" | "kind">): {
  sideLabel: string;
  positionLabel: string;
} {
  return {
    sideLabel: seat.col < 2 ? "Ліва сторона" : "Права сторона",
    positionLabel:
      seat.kind === "sleeper"
        ? "Спальне"
        : seat.kind === "semi_sleeper"
          ? "Напівлежаче"
          : seat.col === 0 || seat.col === 3
            ? "Біля вікна"
            : "Біля проходу",
  };
}

export function findSeat(layout: BusLayout, number: number | null): Seat | null {
  if (number == null) return null;
  return layout.seats.find((s) => s.number === number) ?? null;
}

export function isValidSeatNumber(n: number, layout?: BusLayout): boolean {
  if (!Number.isInteger(n) || n < 1) return false;
  return layout ? n <= layout.seatCount : n <= 46;
}
