import { describe, expect, it } from "vitest";
import {
  emptySeatLayout,
  findSeat,
  isValidSeatNumber,
  seatLabels,
  SEAT_ROWS,
} from "@/lib/seats";

describe("emptySeatLayout", () => {
  it("builds a 46-seat 2+2 coach with a WC in the last row", () => {
    const layout = emptySeatLayout();
    expect(layout.seats).toHaveLength(46);
    expect(layout.rows).toBe(SEAT_ROWS);
    expect(layout.hasToilet).toBe(true);
    const lastRow = layout.seats.filter((s) => s.row === SEAT_ROWS);
    expect(lastRow).toHaveLength(2);
  });

  it("marks occupied and held seats", () => {
    const layout = emptySeatLayout([1, 46], [7]);
    expect(findSeat(layout, 1)?.status).toBe("OCCUPIED");
    expect(findSeat(layout, 46)?.status).toBe("OCCUPIED");
    expect(findSeat(layout, 7)?.status).toBe("HELD");
    expect(findSeat(layout, 8)?.status).toBe("AVAILABLE");
  });

  it("occupied wins over held for the same seat", () => {
    const layout = emptySeatLayout([7], [7]);
    expect(findSeat(layout, 7)?.status).toBe("OCCUPIED");
  });
});

describe("isValidSeatNumber", () => {
  it("accepts 1..46 only", () => {
    expect(isValidSeatNumber(1)).toBe(true);
    expect(isValidSeatNumber(46)).toBe(true);
    expect(isValidSeatNumber(0)).toBe(false);
    expect(isValidSeatNumber(47)).toBe(false);
    expect(isValidSeatNumber(2.5)).toBe(false);
  });
});

describe("seatLabels", () => {
  it("labels window/aisle and side in Ukrainian", () => {
    const layout = emptySeatLayout();
    const first = layout.seats[0];
    const labels = seatLabels(first);
    expect(labels.sideLabel).toMatch(/Ліва|Права/);
    expect(labels.positionLabel).toMatch(/вікна|проходу/);
  });
});
