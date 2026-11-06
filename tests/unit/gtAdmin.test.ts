import { describe, expect, it } from "vitest";
import { groupBusesByCarrier, mapGtTrip, type RawGtTrip } from "@/lib/carriers/grandes-tour/admin";

// Shape of GET /api/v4/booking/trips (TripCities comes as a JSON string).
const trip = (id: number, bus: string, stops: object[], extra: Partial<RawGtTrip> = {}): RawGtTrip => ({
  Id: id,
  IsHidden: false,
  IsDeleted: false,
  BusId: 1289,
  BusNumber: bus,
  CarrierName: "GRANDES TOUR",
  Date: "06.11.2026",
  Direction: "back",
  TripCities: JSON.stringify(stops),
  ...extra,
});

const STOPS = [
  { Number: 7, CityId: 98, CityName: "Малага", IsHidden: false, Date: "06.11.2026", Time: "08:30:00" },
  { Number: 5, CityId: 420, CityName: "Марбелья", IsHidden: false, Date: "06.11.2026", Time: "07:00:00" },
  { Number: 9, CityId: 1, CityName: "Львів", IsHidden: false, Date: "08.11.2026", Time: "05:45:00" },
  { Number: 10, CityId: 999, CityName: "Технічна", IsHidden: true, Date: "08.11.2026", Time: "06:00:00" },
];

describe("Grandes Tour admin data", () => {
  it("shows a trip from its first to its last visible stop", () => {
    expect(mapGtTrip(trip(31189, "BC0056IE", STOPS))).toMatchObject({
      id: 31189,
      from: "Марбелья",
      to: "Львів",
      cityFromId: 420,
      cityToId: 1,
      departureDate: "2026-11-06",
      departureTime: "07:00",
      arrivalDate: "2026-11-08",
      arrivalTime: "05:45",
      busNumber: "BC0056IE",
      carrierName: "GRANDES TOUR",
      status: "назад",
    });
    expect(mapGtTrip(trip(1, "X", [STOPS[0]]))).toBeNull();
    expect(mapGtTrip(trip(2, "X", [], { TripCities: "not json" }))).toBeNull();
  });

  it("groups buses by carrier with their first and last trip", () => {
    const trips = [
      mapGtTrip(trip(1, "BC0056IE", STOPS))!,
      mapGtTrip(trip(2, "BC0056IE", STOPS.map((s) => ({ ...s, Date: "10.11.2026" }))))!,
      mapGtTrip(trip(3, "BH4010TT", STOPS))!,
    ];
    const [gt] = groupBusesByCarrier(trips);
    expect(gt.name).toBe("GRANDES TOUR");
    expect(gt.buses.find((b) => b.busNumber === "BC0056IE")).toMatchObject({ tripCount: 2, firstSeen: "2026-11-06", lastSeen: "2026-11-10" });
    expect(gt.buses).toHaveLength(2);
  });
});
