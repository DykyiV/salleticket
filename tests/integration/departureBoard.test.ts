import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Role, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { findDeparture, listBoardDepartures } from "@/lib/departures/board";

async function clean() {
  await prisma.ticketHistory.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.carrier.deleteMany();
  await prisma.user.deleteMany();
}

const iso = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const gtDay = (isoDay: string) => isoDay.split("-").reverse().join(".");
const TOMORROW = iso(1);

/** GET /api/v4/booking/trips item (TripCities and Route as JSON strings, as GT sends them). */
const rawTrip = (id: number, direction: string, busId: number, cities: [number, string, string][]) => ({
  Id: id,
  IsHidden: false,
  IsDeleted: false,
  BusId: busId,
  BusNumber: busId === 1289 ? "BC0056IE" : "BC0079IT",
  CarrierName: "GRANDES TOUR",
  Date: gtDay(TOMORROW),
  Direction: direction,
  Route: JSON.stringify({ RouteId: 145, PhonesDay1: "+380675554537 (автобус)" }),
  TripCities: JSON.stringify(
    cities.map(([cityId, name, time], i) => ({
      Number: i + 1,
      CityId: cityId,
      CityName: name,
      IsHidden: false,
      Date: gtDay(TOMORROW),
      Time: `${time}:00`,
      PlaceName: `АС ${name}`,
    })),
  ),
});

const BUS_MAP = [
  { id: 1, name: "1", type: "seat", status: "free", floor: 1, x: 1, y: 1 },
  { id: 2, name: "2", type: "seat", status: "purchased", floor: 1, x: 1, y: 2 },
  { id: 3, name: "", type: "path", status: "none", floor: 1, x: 1, y: 3 },
  { id: 4, name: "3", type: "seat90", status: "reserved", floor: 1, x: 1, y: 4 },
  { id: 5, name: "4", type: "seat", status: "hidden", floor: 1, x: 1, y: 5 },
  { id: 6, name: "", type: "toilet", status: "none", floor: 1, x: 2, y: 1 },
];

let users: Record<"admin" | "agent" | "other", { id: string; role: Role }>;
const who = (u: { id: string; role: Role }) => ({ sub: u.id, role: u.role });

async function ticket(
  owner: { id: string },
  out: { key: string; from: string; to: string; time: string },
  opts: { seat?: number; status?: TicketStatus; back?: { key: string; seat: number }; name?: string } = {},
) {
  const carrier = await prisma.carrier.upsert({ where: { name: "Grandes Tour" }, update: {}, create: { name: "Grandes Tour" } });
  const trip = (key: string, from: string, to: string, time: string) =>
    prisma.trip.create({
      data: {
        fromCity: from,
        toCity: to,
        departureTime: new Date(`${TOMORROW}T${time}:00.000Z`),
        arrivalTime: new Date(`${iso(3)}T05:00:00.000Z`),
        price: 100,
        carrierTripKey: key,
        carrierId: carrier.id,
      },
    });
  const outbound = await trip(out.key, out.from, out.to, out.time);
  const back = opts.back ? await trip(opts.back.key, out.to, out.from, "20:00") : null;
  const t = await prisma.ticket.create({
    data: {
      userId: owner.id,
      tripId: outbound.id,
      status: opts.status ?? "RESERVED",
      basePrice: 100,
      finalPrice: 100,
      seatNumber: opts.seat ?? null,
      ...(back ? { tripKind: "ROUND_TRIP", returnTripId: back.id, returnSeatNumber: opts.back!.seat } : {}),
    },
  });
  const [first, last] = (opts.name ?? "Test Passenger").split(" ");
  await prisma.booking.create({
    data: { reference: `KR-${t.id.slice(-5)}`, firstName: first, lastName: last, phone: "+380501234567", finalPrice: 100, ticketId: t.id },
  });
  return t;
}

describe("Виїзди: departures of every carrier in one list", () => {
  beforeAll(async () => {
    await clean();
    vi.stubEnv("GRANDES_TOUR_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL | string) => {
        const path = new URL(String(url)).pathname;
        const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
        if (path === "/api/v4/booking/trips")
          return json([
            rawTrip(31189, "back", 1289, [[420, "Марбелья", "07:00"], [98, "Севілія", "09:00"], [1, "Вінниця", "23:00"]]),
            rawTrip(31200, "to", 1188, [[1, "Вінниця", "08:00"], [420, "Марбелья", "22:00"]]),
          ]);
        if (path === "/api/v3/cache/routes") return json({ routes: [{ id: 145, name: "Вінниця - Севілія - Вінниця", countryISO: "ES" }] });
        if (path === "/api/v2/references/route_details") return json({ schedules: [] });
        if (path === "/api/v2/references/buses")
          return json({
            buses: [
              { id: 1289, number: "BC0056IE", mark: "Van Hool", places_count: 70, floors_count: 2, image_url: "https://img/1289.png", image_thumb_url: "https://img/1289-t.png", has_wifi: true, has_wc: true, has_tv: false },
            ],
          });
        if (path === "/api/v3/booking/get_bus_map_for_trip_id") return json({ busPlaces: BUS_MAP });
        return new Response("not found", { status: 404 });
      }),
    );
    const user = (role: Role) => prisma.user.create({ data: { email: `${role}-${Math.random()}@test.local`, password: "x", role } });
    users = { admin: await user("ADMIN"), agent: await user("AGENT"), other: await user("CUSTOMER") };

    // On GT trip 31189: one ticket sold by the agent, one by someone else, a cancelled one,
    // and the way back of a round trip that left on 31200.
    await ticket(users.agent, { key: "gt-31189-420-1", from: "Марбелья", to: "Вінниця", time: "07:00" }, { seat: 2, name: "Ivan Agentov" });
    await ticket(users.other, { key: "gt-31189-98-1", from: "Севілія", to: "Вінниця", time: "09:00" }, { seat: 3, status: "PAID_CASH", name: "Olha Other" });
    await ticket(users.other, { key: "gt-31189-420-1", from: "Марбелья", to: "Вінниця", time: "07:00" }, { seat: 1, status: "CANCELLED" });
    await ticket(
      users.other,
      { key: "gt-31200-1-420", from: "Вінниця", to: "Марбелья", time: "08:00" },
      { seat: 5, back: { key: "gt-31189-420-1", seat: 4 }, name: "Roman Roundtrip" },
    );
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    await clean();
  });

  it("lists GT departures with route, flag, bus and our passengers the viewer may see", async () => {
    const list = await listBoardDepartures(who(users.admin), iso(0), iso(30));
    expect(list.map((d) => d.id)).toEqual(["gt-31189", "gt-31200"]);
    expect(list[0]).toMatchObject({
      carrier: "GRANDES TOUR",
      route: "Севілія — Вінниця",
      routeKey: "gt-145",
      routeName: "Вінниця — Севілія — Вінниця",
      countryCode: "ES",
      direction: "back",
      from: "Марбелья",
      to: "Вінниця",
      date: TOMORROW,
      time: "07:00",
      bus: { number: "BC0056IE", mark: "Van Hool", seats: 70, thumb: "https://img/1289-t.png" },
      seatsUrl: "/api/admin/departures/gt-31189/seats?from=420&to=1",
      ours: 3,
    });
    expect(list[1]).toMatchObject({ route: "Вінниця — Севілія", direction: "to", ours: 1, bus: { mark: "", seats: 0 } });

    const agentView = await listBoardDepartures(who(users.agent), iso(0), iso(30));
    expect(agentView.map((d) => d.ours)).toEqual([1, 0]);
  });

  it("a departure: our passengers by boarding time, bus with photo, seat plan", async () => {
    const d = await findDeparture(who(users.admin), "gt-31189", TOMORROW);
    expect(d).not.toBeNull();
    expect(d!.passengers.map((p) => [p.name, p.seat, p.from, p.leg])).toEqual([
      ["Ivan Agentov", 2, "Марбелья", "outbound"],
      ["Olha Other", 3, "Севілія", "outbound"],
      ["Roman Roundtrip", 4, "Марбелья", "return"],
    ]);
    expect(d!.busInfo).toEqual({
      number: "BC0056IE",
      mark: "Van Hool",
      seats: 70,
      floors: 2,
      photo: "https://img/1289.png",
      amenities: ["Wi-Fi", "WC"],
    });
    expect(d!.seats!.counts).toEqual({ total: 4, free: 1, reserved: 1, purchased: 1, closed: 1 });
    expect(d!.seats!.places.map((p) => `${p.label || "-"}:${p.kind}:${p.status}`)).toEqual([
      "1:seat:free",
      "2:seat:purchased",
      "-:other:closed",
      "3:seat:reserved",
      "4:seat:closed",
      "-:wc:closed",
    ]);
    expect(d!.stops.map((s) => s.city)).toEqual(["Марбелья", "Севілія", "Вінниця"]);
    expect(d!.phones).toBe("+380675554537 (автобус)");

    const agent = await findDeparture(who(users.agent), "gt-31189", TOMORROW);
    expect(agent!.passengers.map((p) => p.name)).toEqual(["Ivan Agentov"]);

    // Without the day the next month is searched; an unknown id is not found.
    expect((await findDeparture(who(users.admin), "gt-31189"))?.id).toBe("gt-31189");
    expect(await findDeparture(who(users.admin), "gt-99999", TOMORROW)).toBeNull();
    expect(await findDeparture(who(users.admin), "xx-1", TOMORROW)).toBeNull();
  });
});
