import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { grandesTourCarrierAdapter, gtLowestPrices } from "@/lib/carriers/grandes-tour";

// POST /api/v2/booking/search_trips, Львів → Барселона, as Grandes Tour answered on 17.11.2026:
// besides the real trips it lists the Spain → Ukraine bus (route «Севілія - Вінниця»),
// which is in Barcelona two days BEFORE it reaches Lviv.
const gtTrip = (id: number, dep: [string, string], arr: [string, string], duration: string) => ({
  id,
  bus_id: 1289,
  number: 1,
  bus_number: "BC0056IE",
  departure_city_id: 1,
  departure_city: "Львів",
  departure_place: "АС вул. Стрийська 109",
  departure_date: dep[0],
  departure_time_hhmm: dep[1],
  arrival_city_id: 91,
  arrival_city: "Барселона",
  arrival_place: "АС Норд",
  arrival_date: arr[0],
  arrival_time_hhmm: arr[1],
  price: 185,
  duration,
  carrier_name: "GRANDES TOUR",
});
const sequence = (trip: ReturnType<typeof gtTrip>) => ({ canBook: true, canBookWithPaymentAtBoarding: true, currency_code: "EUR", trips: [trip] });
const FOUND = [
  sequence(gtTrip(32864, ["24.11.2026", "14:00"], ["26.11.2026", "05:00"], "1.15:00:00")),
  sequence(gtTrip(31192, ["29.11.2026", "11:00"], ["27.11.2026", "23:55"], "-1.11:05:00")),
];

beforeEach(() => {
  vi.stubEnv("GRANDES_TOUR_API_KEY", "test");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: URL) => {
      const body = url.pathname.endsWith("/cache/cities")
        ? { cities: [{ id: 1, name: "Львів", country_iso: "UA" }, { id: 91, name: "Барселона", country_iso: "ES" }] }
        : url.pathname.endsWith("/search_trips")
          ? { trips_sequences: FOUND }
          : { busPlaces: [] };
      return new Response(JSON.stringify({ success: true, ...body }), { status: 200 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Grandes Tour search", () => {
  it("does not offer a bus going the other way (it would arrive before it leaves)", async () => {
    const trips = await grandesTourCarrierAdapter.search({ from: "Львів", to: "Барселона", date: "2026-11-24", passengers: 1 });
    expect(trips.map((t) => t.id)).toEqual(["gt-32864-1-91"]);
  });

  it("keeps such days out of the price calendar", async () => {
    expect(await gtLowestPrices("Львів", "Барселона", "2026-11-17")).toEqual({ "2026-11-24": 185 });
  });
});
