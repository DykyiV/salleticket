import { describe, expect, it } from "vitest";
import { groupBusesByCarrier, mapGtBus, mapGtTrip, type RawGtTrip } from "@/lib/carriers/grandes-tour/admin";
import { gtDepartureCountry, routeTitle } from "@/lib/departures/board";

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

  it("keeps the route, its phones and the visible stops with their boarding points", () => {
    const route = JSON.stringify({ RouteId: 145, PhonesDay1: " +380675554537 (автобус) " });
    const stops = STOPS.map((s, i) => (i === 1 ? { ...s, PlaceName: "АЗС " } : s));
    expect(mapGtTrip(trip(31189, "BC0056IE", stops, { Route: route }))).toMatchObject({
      direction: "back",
      routeId: 145,
      phones: "+380675554537 (автобус)",
      stops: [
        { cityId: 420, city: "Марбелья", date: "2026-11-06", time: "07:00", place: "АЗС" },
        { cityId: 98, city: "Малага", date: "2026-11-06", time: "08:30", place: undefined },
        { cityId: 1, city: "Львів", date: "2026-11-08", time: "05:45", place: undefined },
      ],
    });
  });

  it("names a departure the way GT does: the route in the direction of travel", () => {
    expect(routeTitle("Вінниця - Севілія - Вінниця", "to", "Вінниця", "Марбелья")).toBe("Вінниця — Севілія");
    expect(routeTitle("Вінниця - Севілія - Вінниця", "back", "Марбелья", "Вінниця")).toBe("Севілія — Вінниця");
    expect(routeTitle(undefined, "back", "Марбелья", "Вінниця")).toBe("Марбелья — Вінниця");
    expect(routeTitle("Київ - Мадрид", "to", "Київ", "Мадрид")).toBe("Київ — Мадрид");
  });

  it("a bus: plate, make, seats, photo and only the comfort it has", () => {
    expect(
      mapGtBus({ id: 1289, number: " BC0056IE", mark: "Van Hool", places_count: 70, floors_count: 2, image_url: "https://p", image_thumb_url: "", has_wifi: true, has_tv: false, has_wc: true }),
    ).toEqual({ id: 1289, number: "BC0056IE", mark: "Van Hool", seats: 70, floors: 2, photo: "https://p", thumb: null, amenities: ["Wi-Fi", "WC"] });
  });

  it("a departure's flag is the country it leaves from", () => {
    expect(gtDepartureCountry("Дніпро", "to", "DE")).toBe("UA");
    expect(gtDepartureCountry("Марбелья", "back", "ES")).toBe("ES");
    expect(gtDepartureCountry("Невідоме", "to", "ES")).toBe("UA");
    expect(gtDepartureCountry("Невідоме", "back", "de")).toBe("DE");
    expect(gtDepartureCountry("Невідоме", undefined, "DE")).toBe("");
  });
});
