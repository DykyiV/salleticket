import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gtCheckCard, gtFare } from "@/lib/carriers/grandes-tour/pricing";

// Grandes Tour as it answered on 23.11.2026 for the Black Friday code BF20.
const BF20 = {
  card_number: "BF20",
  is_blocked: false,
  percent: 20,
  start_date: "22.11.2026",
  end_date: "30.11.2026",
  is_within_active_period: true,
};

const priceRequests: Record<string, unknown>[] = [];

beforeEach(() => {
  priceRequests.length = 0;
  vi.stubEnv("GRANDES_TOUR_API_KEY", "test");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: URL, init?: RequestInit) => {
      const path = url.pathname;
      const json = init?.body ? JSON.parse(String(init.body)) : {};
      let body: Record<string, unknown> = { success: true };
      if (path.endsWith("/get_discount_card_info")) body = { success: true, discount: json.number === "BF20" ? BF20 : null };
      if (path.endsWith("/passenger_types_by_trip_id")) body = { success: true, passenger_types: [{ id: 1, name: "Дорослий" }] };
      if (path.endsWith("/passenger_ticket_price")) {
        priceRequests.push(json);
        const card = json.price_trips_to?.[0]?.discount_cart;
        // GT refuses to price a card for a passenger without a name.
        body =
          card && !json.first_name
            ? { success: false, price: 0, priceBeforeDiscount: 0, error: "Ім'я пасажира не може бути порожнім або відсутнім." }
            : { success: true, price: card ? 148 : 185, priceBeforeDiscount: 185 };
      }
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const leg = { tripId: 32864, fromId: 1, toId: 91 };

describe("Grandes Tour discount card", () => {
  it("prices a card with the passenger's name (GT refuses it without one)", async () => {
    const fare = await gtFare({ to: leg, kind: "ADULT", card: "BF20", name: "Ivan Petrenko Junior" });
    expect(fare.price).toBe(148);
    expect(priceRequests[0]).toMatchObject({ first_name: "IVAN", last_name: "PETRENKO JUNIOR" });
  });

  it("previews a card before the name is typed", async () => {
    expect((await gtFare({ to: leg, kind: "ADULT", card: "BF20" })).price).toBe(148);
  });

  it("sends no name without a card, as before", async () => {
    expect((await gtFare({ to: leg, kind: "ADULT" })).price).toBe(185);
    expect(priceRequests[0]).not.toHaveProperty("first_name");
  });

  it("pay at boarding: the card must still be valid on the day of the trip", async () => {
    expect(await gtCheckCard("BF20", ["2026-11-29"])).toEqual({ status: "ok", number: "BF20", percent: 20 });
    expect(await gtCheckCard("BF20", ["2026-11-30"])).toMatchObject({ status: "ok" });
    expect(await gtCheckCard("BF20", ["2026-11-28", "2026-12-04"])).toEqual({
      status: "invalid",
      number: "BF20",
      message: "Діє лише на поїздки до 30.11.2026 (оплата при посадці)",
    });
    // Paid online now: the trip date does not matter.
    expect(await gtCheckCard("BF20")).toMatchObject({ status: "ok" });
  });
});
