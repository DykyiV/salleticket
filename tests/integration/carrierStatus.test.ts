import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { GtLegState } from "@/lib/carriers/grandes-tour/pricing";
import { carrierLegChanges, syncCarrierTickets } from "@/lib/tickets/carrierStatus";

async function clean() {
  await prisma.ticketHistory.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.carrier.deleteMany();
  await prisma.user.deleteMany();
}

const rnd = () => Math.random().toString(36).slice(2, 8);
const DEP = new Date("2030-03-10T11:20:00.000Z");
const ARR = new Date("2030-03-12T05:00:00.000Z");
const BACK_DEP = new Date("2030-03-20T09:00:00.000Z");
const BACK_ARR = new Date("2030-03-22T06:00:00.000Z");

async function newTrip(departureTime = DEP, arrivalTime = ARR, from = "Львів", to = "Мадрид") {
  const carrier = await prisma.carrier.create({ data: { name: `Grandes Tour ${rnd()}` } });
  return prisma.trip.create({
    data: {
      fromCity: from,
      toCity: to,
      departureTime,
      arrivalTime,
      price: 81,
      carrierFromPlace: "АС Стрийська",
      carrierFromMap: "https://www.google.com/maps?q=49.8,24.0",
      carrierId: carrier.id,
    },
  });
}

async function gtTicket(
  carrierRef: string,
  opts: { tripId?: string; departureTime?: Date; status?: TicketStatus; seat?: number; returnTripId?: string } = {},
) {
  const tripId = opts.tripId ?? (await newTrip(opts.departureTime, opts.departureTime && new Date(opts.departureTime.getTime() + 86_400_000))).id;
  const user = await prisma.user.create({ data: { email: `u${rnd()}@test.local`, password: "x" } });
  const ticket = await prisma.ticket.create({
    data: {
      userId: user.id,
      tripId,
      status: opts.status ?? "RESERVED",
      basePrice: 81,
      finalPrice: 81,
      carrierRef,
      seatNumber: opts.seat ?? 7,
      ...(opts.returnTripId ? { tripKind: "ROUND_TRIP", returnTripId: opts.returnTripId, returnSeatNumber: 3 } : {}),
    },
  });
  await prisma.booking.create({
    data: { reference: `KR-${rnd()}`, firstName: "Test", lastName: "Test", phone: "+380501234567", finalPrice: 81, ticketId: ticket.id },
  });
  return ticket;
}

const ddmmyyyy = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join(".");
const hhmm = (d: Date) => d.toISOString().slice(11, 16);

/** A GT seat row as get_order_details returns it. */
function row(dep: Date, arr: Date, seat: number, over: Record<string, unknown> = {}) {
  return {
    trip_id: 501,
    city_from_id: 1,
    city_from_name: "Львів",
    city_from_place_name: "АС Стрийська",
    city_to_id: 2,
    city_to_name: "Мадрид",
    city_to_place_name: "",
    departure_date: ddmmyyyy(dep),
    departure_time_hhmm: hhmm(dep),
    arrival_date: ddmmyyyy(arr),
    arrival_time_hhmm: hhmm(arr),
    place_name: String(seat),
    bus_number: "",
    ...over,
  };
}

const ticketOf = (id: string) => prisma.ticket.findUniqueOrThrow({ where: { id }, include: { trip: true, returnTrip: true, booking: true } });
const actions = async (id: string) => (await prisma.ticketHistory.findMany({ where: { ticketId: id } })).map((h) => h.action);

describe("syncCarrierTickets (Grandes Tour → site)", () => {
  const calls: string[] = [];
  /** GT order id → its tickets as GT returns them. */
  let orders: Record<number, unknown[]> = {};

  beforeEach(async () => {
    await clean();
    calls.length = 0;
    orders = {};
    vi.stubEnv("GRANDES_TOUR_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL | string, init?: RequestInit) => {
        const path = new URL(String(url)).pathname;
        calls.push(`${init?.method ?? "GET"} ${path}`);
        if (path === "/api/v2/booking/get_order_details") {
          const { id } = JSON.parse(String(init?.body)) as { id: number };
          return new Response(JSON.stringify({ order_details: { id, tickets: orders[id] ?? [] }, success: true }), { status: 200 });
        }
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("cancels here what GT cancelled, without sending the cancel back", async () => {
    orders[10] = [
      { id: 100, status: "canceled", price: 81, trip_seats_to: [row(DEP, ARR, 7)] },
      { id: 101, status: "canceled", price: 81, trip_seats_to: [row(DEP, ARR, 8)] },
    ];
    orders[20] = [{ id: 200, status: "reserved", price: 81, trip_seats_to: [row(DEP, ARR, 7)] }];
    const gone = await gtTicket("GT:10:100");
    const alive = await gtTicket("GT:20:200");

    expect(await syncCarrierTickets([gone.id, alive.id])).toEqual({ cancelled: 1, changed: 0 });
    expect((await ticketOf(gone.id)).status).toBe("CANCELLED");
    expect((await ticketOf(alive.id)).status).toBe("RESERVED");
    expect(await actions(gone.id)).toContain("CANCELLED_BY_CARRIER");
    expect(await actions(alive.id)).toEqual([]);

    await new Promise((r) => setTimeout(r, 20));
    expect(calls.some((c) => c.includes("cancel_ticket"))).toBe(false);
  });

  it("the periodic sweep checks upcoming trips only", async () => {
    orders[10] = [
      { id: 100, status: "canceled", trip_seats_to: [row(DEP, ARR, 7)] },
      { id: 101, status: "canceled", trip_seats_to: [row(DEP, ARR, 8)] },
    ];
    const upcoming = await gtTicket("GT:10:100");
    const past = await gtTicket("GT:10:101", { departureTime: new Date(Date.now() - 3 * 86_400_000) });

    expect((await syncCarrierTickets()).cancelled).toBe(1);
    expect((await ticketOf(upcoming.id)).status).toBe("CANCELLED");
    expect((await ticketOf(past.id)).status).toBe("RESERVED");
  });

  it("takes the seat changed in GT, once", async () => {
    orders[30] = [{ id: 300, status: "reserved", price: 81, trip_seats_to: [row(DEP, ARR, 66)] }];
    const t = await gtTicket("GT:30:300", { seat: 1 });

    expect(await syncCarrierTickets([t.id])).toEqual({ cancelled: 0, changed: 1 });
    const after = await ticketOf(t.id);
    expect(after.seatNumber).toBe(66);
    expect(after.version).toBe(t.version + 1);
    const history = await prisma.ticketHistory.findMany({ where: { ticketId: t.id } });
    expect(history.map((h) => h.action)).toEqual(["CHANGED_BY_CARRIER"]);
    expect(JSON.parse(history[0].changes!)).toEqual({ seatNumber: { from: 1, to: 66 } });

    // Already in step: nothing more to do.
    expect(await syncCarrierTickets([t.id])).toEqual({ cancelled: 0, changed: 0 });
    expect(await actions(t.id)).toHaveLength(1);
  });

  it("takes a new date, time and city; a trip shared with another ticket is copied", async () => {
    const shared = await newTrip();
    const moved = await gtTicket("GT:40:400", { tripId: shared.id });
    const stays = await gtTicket("GT:40:401", { tripId: shared.id });
    const dep = new Date("2030-03-24T17:00:00.000Z");
    const arr = new Date("2030-03-26T19:00:00.000Z");
    orders[40] = [
      {
        id: 400,
        status: "reserved",
        price: 81,
        trip_seats_to: [row(dep, arr, 7, { city_to_id: 3, city_to_name: "Барселона", city_to_place_name: "АС Норд (30 плат.)", bus_number: "BC 1234 AA" })],
      },
      { id: 401, status: "reserved", price: 81, trip_seats_to: [row(DEP, ARR, 7)] },
    ];

    expect(await syncCarrierTickets([moved.id, stays.id])).toEqual({ cancelled: 0, changed: 1 });
    const after = await ticketOf(moved.id);
    expect(after.tripId).not.toBe(shared.id);
    expect(after.trip).toMatchObject({
      fromCity: "Львів",
      toCity: "Барселона",
      departureTime: dep,
      arrivalTime: arr,
      carrierFromPlace: "АС Стрийська",
      carrierFromMap: "https://www.google.com/maps?q=49.8,24.0",
      carrierToPlace: "АС Норд (30 плат.)",
      carrierBus: "BC 1234 AA",
    });
    expect(after.trip!.carrierToMap).toContain("google.com/maps/search");
    expect(after.trip!.carrierTripKey).toBe("gt-501-1-3");
    const other = await ticketOf(stays.id);
    expect(other.tripId).toBe(shared.id);
    // GT's trip id is filled in on the shared row in place, silently.
    expect(other.trip).toMatchObject({ toCity: "Мадрид", departureTime: DEP, carrierTripKey: "gt-501-1-2" });
    expect(await actions(stays.id)).toEqual([]);

    const changes = JSON.parse((await prisma.ticketHistory.findFirstOrThrow({ where: { ticketId: moved.id } })).changes!);
    expect(changes).toMatchObject({
      departure: { from: DEP.toISOString(), to: dep.toISOString() },
      toCity: { from: "Мадрид", to: "Барселона" },
    });
  });

  it("edits a trip row used by this ticket only, and follows the return direction", async () => {
    const back = await newTrip(BACK_DEP, BACK_ARR, "Мадрид", "Львів");
    const t = await gtTicket("GT:50:500", { returnTripId: back.id });
    const newBack = new Date("2030-03-27T09:00:00.000Z");
    orders[50] = [
      {
        id: 500,
        status: "reserved",
        price: 81,
        trip_seats_to: [row(DEP, new Date("2030-03-13T05:00:00.000Z"), 7)],
        trip_seats_back: [row(newBack, new Date("2030-03-29T06:00:00.000Z"), 12, { city_from_name: "Мадрид", city_to_name: "Львів" })],
      },
    ];

    expect((await syncCarrierTickets([t.id])).changed).toBe(1);
    const after = await ticketOf(t.id);
    expect(after.tripId).toBe(t.tripId);
    expect(after.trip!.arrivalTime).toEqual(new Date("2030-03-13T05:00:00.000Z"));
    expect(after.returnTripId).toBe(back.id);
    expect(after.returnTrip!.departureTime).toEqual(newBack);
    expect(after.returnSeatNumber).toBe(12);
    const changes = JSON.parse((await prisma.ticketHistory.findFirstOrThrow({ where: { ticketId: t.id } })).changes!);
    expect(Object.keys(changes).sort()).toEqual(["arrival", "returnArrival", "returnDeparture", "returnSeatNumber"]);
  });

  it("a ticket paid on the bus takes GT's fare; a paid one keeps its price", async () => {
    orders[60] = [
      { id: 600, status: "reserved", price: 93.6, trip_seats_to: [row(DEP, ARR, 7)] },
      { id: 601, status: "reserved", price: 93.6, trip_seats_to: [row(DEP, ARR, 9)] },
    ];
    const reserved = await gtTicket("GT:60:600");
    const paid = await gtTicket("GT:60:601", { status: "PAID_CASH" });

    expect((await syncCarrierTickets([reserved.id, paid.id])).changed).toBe(2);
    const r = await ticketOf(reserved.id);
    expect(r.finalPrice).toBe(93.6);
    expect(r.basePrice).toBe(93.6);
    expect(r.booking!.finalPrice).toBe(93.6);
    const p = await ticketOf(paid.id);
    expect(p.finalPrice).toBe(81);
    expect(p.seatNumber).toBe(9);
    const changes = JSON.parse((await prisma.ticketHistory.findFirstOrThrow({ where: { ticketId: paid.id } })).changes!);
    expect(changes.carrierFare).toEqual({ from: 81, to: 93.6 });

    // The paid ticket's other fare alone never makes a new history entry.
    expect((await syncCarrierTickets([reserved.id, paid.id])).changed).toBe(0);
  });
});

describe("carrierLegChanges", () => {
  const trip = {
    fromCity: "Кайзерслаутерн",
    toCity: "Рівне",
    departureTime: DEP,
    arrivalTime: ARR,
    carrierFromPlace: "ZOB, Bussteig 3",
    carrierToPlace: "АС Рівне",
    carrierFromMap: "https://www.google.com/maps?q=49.4,7.7",
    carrierToMap: null,
    carrierBus: "AA 0001 BB",
    carrierPhones: null,
    carrierTripKey: "gt-1-2-3",
  };
  const gt = (over: Partial<GtLegState> = {}): GtLegState => ({
    key: "gt-1-2-3",
    seatNumber: 59,
    date: "2030-03-10",
    typeId: null,
    fromCity: "Кайзерслаутерн",
    toCity: "Рівне",
    departureAt: "2030-03-10T11:20",
    arrivalAt: "2030-03-12T05:00",
    fromPlace: "ZOB,  Bussteig 3 ",
    toPlace: "АС Рівне",
    bus: null,
    phones: null,
    ...over,
  });

  it("finds nothing when GT has the same (spacing and empty fields aside)", () => {
    expect(carrierLegChanges(trip, 59, gt())).toEqual({ trip: {}, seat: null });
    expect(carrierLegChanges(trip, 59, gt({ fromPlace: null, toPlace: null, seatNumber: Number.NaN, departureAt: "" }))).toEqual({
      trip: {},
      seat: null,
    });
  });

  it("another city drops the old city's stop", () => {
    const out = carrierLegChanges(trip, 59, gt({ toCity: "Київ", toPlace: null, seatNumber: 67 }));
    expect(out).toEqual({ trip: { toCity: "Київ", carrierToPlace: null, carrierToMap: null }, seat: 67 });
  });
});
