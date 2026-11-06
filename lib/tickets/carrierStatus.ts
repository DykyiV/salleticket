import type { Prisma, TicketStatus, Trip } from "@prisma/client";
import { prisma } from "@/lib/db";
import { grandesTourEnabled } from "@/lib/carriers/grandes-tour/client";
import { gtPlaceMap } from "@/lib/carriers/grandes-tour";
import {
  gtIsCancelled,
  gtOrderTickets,
  gtRefParts,
  type GtLegState,
  type GtOrderTicket,
} from "@/lib/carriers/grandes-tour/pricing";
import { recordTicketHistory } from "@/lib/tickets/history";
import { updateTicketStatus } from "@/lib/tickets/service";
import { updateTicketVersioned } from "@/lib/tickets/version";

const ACTIVE: TicketStatus[] = ["RESERVED", "AWAITING_PAYMENT", "PAID_ONLINE", "PAID_CASH"];
const SWEEP_EVERY_MS = 60_000;
/** GT orders asked at the same time. */
const PARALLEL = 4;
let lastSweep = 0;

const round2 = (n: number) => Math.round(n * 100) / 100;
const same = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? "").replace(/\s+/g, " ").trim().toLowerCase() === (b ?? "").replace(/\s+/g, " ").trim().toLowerCase();
/** "2026-11-24T11:20" (local time, stored as UTC like every trip here) → Date; null when unusable. */
const localAt = (v: string) => {
  const d = new Date(`${v}:00.000Z`);
  return v && !Number.isNaN(d.getTime()) ? d : null;
};

type TripPart = Pick<
  Trip,
  | "fromCity"
  | "toCity"
  | "departureTime"
  | "arrivalTime"
  | "carrierFromPlace"
  | "carrierToPlace"
  | "carrierFromMap"
  | "carrierToMap"
  | "carrierBus"
  | "carrierPhones"
>;

export type LegChanges = {
  /** Trip fields to change (empty = the trip is as GT has it). */
  trip: Partial<TripPart>;
  /** New seat (null = unchanged). */
  seat: number | null;
};

/**
 * What differs between one direction of our ticket and the same direction in
 * Grandes Tour: cities, departure and arrival, boarding / drop-off point, bus,
 * seat. Anything GT leaves empty is kept as it is here.
 */
export function carrierLegChanges(trip: TripPart, seat: number | null, gt: GtLegState): LegChanges {
  const out: Partial<TripPart> = {};
  if (gt.fromCity && !same(gt.fromCity, trip.fromCity)) out.fromCity = gt.fromCity;
  if (gt.toCity && !same(gt.toCity, trip.toCity)) out.toCity = gt.toCity;
  const dep = localAt(gt.departureAt);
  if (dep && dep.getTime() !== trip.departureTime.getTime()) out.departureTime = dep;
  const arr = localAt(gt.arrivalAt);
  if (arr && arr.getTime() !== trip.arrivalTime.getTime()) out.arrivalTime = arr;

  const fromCity = out.fromCity ?? trip.fromCity;
  const toCity = out.toCity ?? trip.toCity;
  // Another city has another stop: its point is GT's (or none), never the old city's.
  if (out.fromCity ? !same(gt.fromPlace, trip.carrierFromPlace) : gt.fromPlace && !same(gt.fromPlace, trip.carrierFromPlace)) {
    out.carrierFromPlace = gt.fromPlace;
    out.carrierFromMap = gtPlaceMap(gt.fromPlace ?? undefined, fromCity) ?? null;
  }
  if (out.toCity ? !same(gt.toPlace, trip.carrierToPlace) : gt.toPlace && !same(gt.toPlace, trip.carrierToPlace)) {
    out.carrierToPlace = gt.toPlace;
    out.carrierToMap = gtPlaceMap(gt.toPlace ?? undefined, toCity) ?? null;
  }
  if (gt.bus && !same(gt.bus, trip.carrierBus)) out.carrierBus = gt.bus;
  if (gt.phones && !same(gt.phones, trip.carrierPhones)) out.carrierPhones = gt.phones;

  const newSeat = Number.isInteger(gt.seatNumber) && gt.seatNumber > 0 && gt.seatNumber !== seat ? gt.seatNumber : null;
  return { trip: out, seat: newSeat };
}

const HISTORY_FIELD: Record<keyof TripPart, string> = {
  fromCity: "fromCity",
  toCity: "toCity",
  departureTime: "departure",
  arrivalTime: "arrival",
  carrierFromPlace: "fromPlace",
  carrierToPlace: "toPlace",
  carrierFromMap: "",
  carrierToMap: "",
  carrierBus: "bus",
  carrierPhones: "carrierPhones",
};
const historyValue = (v: unknown) => (v instanceof Date ? v.toISOString() : (v ?? null));

type SyncedTicket = Prisma.TicketGetPayload<{ include: { trip: true; returnTrip: true; booking: true } }>;

/**
 * Brings one of our tickets in line with the same ticket in Grandes Tour after
 * GT staff changed it there (seat, date / time, cities, stop, bus; both
 * directions). Trip rows shared with other tickets (a group booked together)
 * are copied, not edited. A ticket paid on the bus also takes GT's fare; any
 * other keeps its price (GT's fare goes into the history). Returns whether
 * anything changed.
 */
export async function applyCarrierChanges(ticket: SyncedTicket, gt: GtOrderTicket): Promise<boolean> {
  const legs = [
    { name: "outbound" as const, trip: ticket.trip, seat: ticket.seatNumber, gt: gt.to },
    { name: "return" as const, trip: ticket.returnTrip, seat: ticket.returnSeatNumber, gt: gt.back },
  ].map((l) => ({ ...l, changes: l.trip && l.gt ? carrierLegChanges(l.trip, l.seat, l.gt) : null }));
  const legChanged = legs.some((l) => l.changes && (Object.keys(l.changes.trip).length || l.changes.seat != null));

  // Only a ticket paid on the bus follows GT's fare: a paid one keeps what was
  // paid, and one awaiting an online payment keeps the amount being paid.
  const keepsPrice = ticket.status !== "RESERVED";
  const fare = round2(ticket.finalPrice - ticket.serviceFee);
  const gtFare = gt.price != null && gt.price > 0 ? round2(gt.price) : null;
  const fareChanged = gtFare != null && Math.abs(gtFare - fare) >= 0.01;
  if (!legChanged && !(fareChanged && !keepsPrice)) return false;

  await prisma.$transaction(async (tx) => {
    const data: Prisma.TicketUncheckedUpdateInput = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const leg of legs) {
      if (!leg.changes || !leg.trip) continue;
      const prefix = leg.name === "return" ? "return" : "";
      const key = (f: string) => (prefix ? prefix + f[0].toUpperCase() + f.slice(1) : f);
      const tripFields = leg.changes.trip;
      if (Object.keys(tripFields).length) {
        const shared = await tx.ticket.count({
          where: { id: { not: ticket.id }, OR: [{ tripId: leg.trip.id }, { returnTripId: leg.trip.id }] },
        });
        if (shared) {
          const t = leg.trip;
          const created = await tx.trip.create({
            data: {
              fromCity: t.fromCity,
              toCity: t.toCity,
              departureTime: t.departureTime,
              arrivalTime: t.arrivalTime,
              price: t.price,
              carrierPhones: t.carrierPhones,
              carrierBus: t.carrierBus,
              carrierFromPlace: t.carrierFromPlace,
              carrierToPlace: t.carrierToPlace,
              carrierFromMap: t.carrierFromMap,
              carrierToMap: t.carrierToMap,
              transportType: t.transportType,
              carrierId: t.carrierId,
              ...tripFields,
            },
          });
          data[leg.name === "return" ? "returnTripId" : "tripId"] = created.id;
        } else {
          await tx.trip.update({ where: { id: leg.trip.id }, data: tripFields });
        }
        for (const [field, to] of Object.entries(tripFields) as [keyof TripPart, unknown][]) {
          const name = HISTORY_FIELD[field];
          if (name) changes[key(name)] = { from: historyValue(leg.trip[field]), to: historyValue(to) };
        }
      }
      if (leg.changes.seat != null) {
        data[leg.name === "return" ? "returnSeatNumber" : "seatNumber"] = leg.changes.seat;
        changes[key("seatNumber")] = { from: leg.seat, to: leg.changes.seat };
      }
    }

    if (fareChanged && gtFare != null) {
      if (keepsPrice) {
        changes.carrierFare = { from: fare, to: gtFare };
      } else {
        const price = round2(gtFare + ticket.serviceFee);
        const percent = ticket.commissionPercent;
        data.finalPrice = price;
        data.basePrice = fare > 0 ? round2((ticket.basePrice * gtFare) / fare) : price;
        if (percent != null) {
          data.commissionAmount = round2((gtFare * percent) / 100 + ticket.serviceFee);
          data.carrierAmount = round2(gtFare - (gtFare * percent) / 100);
        }
        changes.finalPrice = { from: ticket.finalPrice, to: price };
        if (ticket.booking) await tx.booking.update({ where: { id: ticket.booking.id }, data: { finalPrice: price } });
      }
    }

    // The version bump also keeps a concurrent edit from being overwritten.
    await updateTicketVersioned(tx, ticket.id, ticket.version, data);
    await recordTicketHistory(tx, {
      ticketId: ticket.id,
      action: "CHANGED_BY_CARRIER",
      source: "SYSTEM",
      changedBy: null,
      changes,
    });
  });
  return true;
}

/**
 * Keeps Grandes Tour tickets in step with GT (their site or office): a ticket
 * cancelled there is cancelled here (without sending the cancel back), and a
 * change made there (seat, date / time, cities, stop, fare) is copied here.
 * With ticket ids: checks those tickets. Without: checks every active GT
 * ticket of a trip not yet a day in the past, at most once a minute.
 * A GT error skips that order until the next check.
 */
export async function syncCarrierTickets(ticketIds?: string[]): Promise<{ cancelled: number; changed: number }> {
  const result = { cancelled: 0, changed: 0 };
  if (!grandesTourEnabled()) return result;
  if (!ticketIds) {
    if (Date.now() - lastSweep < SWEEP_EVERY_MS) return result;
    lastSweep = Date.now();
  }
  const tickets = await prisma.ticket.findMany({
    where: {
      status: { in: ACTIVE },
      carrierRef: { startsWith: "GT:" },
      ...(ticketIds
        ? { id: { in: ticketIds } }
        : { trip: { departureTime: { gte: new Date(Date.now() - 86_400_000) } } }),
    },
    include: { trip: true, returnTrip: true, booking: true },
  });

  const byOrder = new Map<number, { ticket: SyncedTicket; gtTicketId: number }[]>();
  for (const ticket of tickets) {
    const ref = gtRefParts(ticket.carrierRef);
    if (ref) byOrder.set(ref.orderId, [...(byOrder.get(ref.orderId) ?? []), { ticket, gtTicketId: ref.ticketId }]);
  }
  const orders = [...byOrder.entries()];
  for (let i = 0; i < orders.length; i += PARALLEL) {
    const batch = orders.slice(i, i + PARALLEL);
    const details = await Promise.all(batch.map(([orderId]) => gtOrderTickets(orderId).catch(() => null)));
    for (const [j, [, list]] of batch.entries()) {
      for (const { ticket, gtTicketId } of list) {
        const gt = details[j]?.get(gtTicketId);
        if (!gt) continue;
        try {
          if (gtIsCancelled(gt.status)) {
            await updateTicketStatus(ticket.id, "CANCELLED", null, {
              source: "SYSTEM",
              action: "CANCELLED_BY_CARRIER",
              carrierCancelled: true,
            });
            result.cancelled++;
          } else if (await applyCarrierChanges(ticket, gt)) {
            result.changed++;
          }
        } catch {
          // Changed concurrently — checked again next time.
        }
      }
    }
  }
  return result;
}
