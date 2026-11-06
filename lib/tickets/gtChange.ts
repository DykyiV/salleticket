import { prisma } from "@/lib/db";
import { grandesTourCarrierAdapter } from "@/lib/carriers/grandes-tour";
import {
  gtCancelTicket,
  gtLegFromKey,
  gtRefParts,
  gtTicketDetails,
  type GtTicketLeg,
} from "@/lib/carriers/grandes-tour/pricing";
import { notifyStaff } from "@/lib/notify";
import { scheduleCarrierCancel } from "@/lib/tickets/carrierSync";
import { recordTicketHistory, type RequestMeta, type TicketHistorySource } from "@/lib/tickets/history";
import { updateTicketVersioned } from "@/lib/tickets/version";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Why a Grandes Tour ticket's date or seat can't be changed here (null = it can). */
export function gtChangeBlocked(ticket: { status: string }): string | null {
  if (ticket.status === "CANCELLED" || ticket.status === "REFUNDED") return "Квиток скасовано";
  return null;
}

export class GtChangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GtChangeError";
  }
}

const reason = (err: unknown) =>
  (err instanceof Error ? err.message : String(err)).replace(/^Grandes Tour [^:]+: /, "");

/**
 * Moves one direction of a Grandes Tour ticket to another departure (or
 * another seat). GT has no "change": the same passenger (fare type, card) is
 * reserved again and our ticket follows (trip, seat, GT ticket, price).
 *  - One-way: the new seat is reserved first; the old ticket is cancelled
 *    after. Nothing changes when GT refuses.
 *  - Round trip (one GT ticket for both directions): the old ticket holds the
 *    unchanged direction's seat, so it is cancelled first and a new round trip
 *    reserved; when GT refuses, the old round trip is reserved again (or staff
 *    are told to do it by hand).
 * A paid ticket keeps the price it was paid at (GT's new fare goes into the
 * history); an unpaid one takes the new price.
 */
export async function changeGtTicketTrip(input: {
  ticketId: string;
  leg?: "outbound" | "return";
  tripKey: string;
  date: string;
  seatNumber: number;
  changedBy: string | null;
  source: TicketHistorySource;
  request?: RequestMeta;
}): Promise<{ price: number; oldPrice: number }> {
  const leg = input.leg ?? "outbound";
  const ticket = await prisma.ticket.findUnique({
    where: { id: input.ticketId },
    include: { trip: true, returnTrip: true },
  });
  const booking = await prisma.booking.findFirst({ where: { ticketId: input.ticketId } });
  const old = gtRefParts(ticket?.carrierRef);
  if (!ticket || !booking || !ticket.trip || !old || !ticket.carrierRef) throw new GtChangeError("Це не квиток Grandes Tour");
  if (!gtLegFromKey(input.tripKey) || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new GtChangeError("Невідомий рейс");
  const legTrip = leg === "return" ? ticket.returnTrip : ticket.trip;
  if (!legTrip) throw new GtChangeError("У квитку немає зворотної поїздки");

  const found = (
    await grandesTourCarrierAdapter.search({ from: legTrip.fromCity, to: legTrip.toCity, date: input.date })
  ).find((t) => t.id === input.tripKey);
  if (!found) throw new GtChangeError("Рейс не знайдено — оновіть список рейсів");

  const details = await gtTicketDetails(old.orderId, old.ticketId);
  if (leg === "return" && !details.back) throw new GtChangeError("У квитку Grandes Tour немає зворотної поїздки");
  const chosen: GtTicketLeg = { key: input.tripKey, seatNumber: input.seatNumber, date: input.date, typeId: null };
  const to = leg === "outbound" ? chosen : details.to;
  const back = details.back ? (leg === "return" ? chosen : details.back) : null;
  const name = `${booking.firstName} ${booking.lastName}`.trim();
  const reserve = async (t: GtTicketLeg, b: GtTicketLeg | null) => {
    const res = await grandesTourCarrierAdapter.book({
      tripId: t.key,
      carrierId: grandesTourCarrierAdapter.id,
      passenger: { name, phone: booking.phone },
      passengers: [
        { name, phone: booking.phone, fareTypeId: details.to.typeId, seatNumber: t.seatNumber, returnSeatNumber: b?.seatNumber ?? null },
      ],
      tripSnapshot: { from: ticket.trip!.fromCity, to: ticket.trip!.toCity, currency: "EUR" },
      travelDate: t.date,
      returnTripId: b?.key ?? null,
      returnDate: b?.date,
      discountCard: details.discountCard,
      paymentAtBoarding: ticket.status !== "AWAITING_PAYMENT",
    });
    const fresh = res.tickets?.[0];
    if (!fresh || !gtRefParts(fresh.ref)) throw new GtChangeError("Grandes Tour не повернув номер нового квитка");
    return fresh;
  };
  const history = (action: string, changes: Record<string, { from: unknown; to: unknown }>) =>
    recordTicketHistory(prisma, {
      ticketId: ticket.id,
      action,
      source: input.source,
      changedBy: input.changedBy,
      request: input.request,
      changes,
    });

  let fresh: Awaited<ReturnType<typeof reserve>>;
  if (!back) {
    fresh = await reserve(to, null);
  } else {
    await gtCancelTicket(ticket.carrierRef);
    try {
      fresh = await reserve(to, back);
    } catch (err) {
      const restored = await reserve(details.to, details.back).catch(() => null);
      if (restored) {
        await prisma.ticket.update({ where: { id: ticket.id }, data: { carrierRef: restored.ref } });
        await history("CARRIER_REBOOKED", { carrierRef: { from: ticket.carrierRef, to: restored.ref } });
        throw new GtChangeError(`Grandes Tour відмовив: ${reason(err)}. Попередню бронь відновлено.`);
      }
      await history("CARRIER_REBOOK_FAILED", { carrierRef: { from: ticket.carrierRef, to: reason(err) } });
      await notifyStaff({
        kind: "carrier_sync_failed",
        title: `Терміново: квиток ${booking.reference} без броні в Grandes Tour`,
        body: `Стару бронь ${ticket.carrierRef} скасовано, нову створити не вдалося: ${reason(err)}`,
        link: `/cabinet/tickets/${booking.reference}`,
      }).catch(() => undefined);
      throw new GtChangeError(
        `Grandes Tour відмовив: ${reason(err)}. Стару бронь скасовано, відновити не вдалося — забронюйте квиток у Grandes Tour вручну.`
      );
    }
  }

  const fare = fresh.price;
  const paid = ticket.status === "PAID_ONLINE" || ticket.status === "PAID_CASH";
  const price = paid ? ticket.finalPrice : round2(fare + ticket.serviceFee);
  const percent = ticket.commissionPercent;
  const oldSeat = leg === "return" ? ticket.returnSeatNumber : ticket.seatNumber;
  try {
    await prisma.$transaction(async (tx) => {
      const trip = await tx.trip.create({
        data: {
          fromCity: found.from,
          toCity: found.to,
          departureTime: new Date(found.departureAt ?? `${input.date}T${found.departure}:00.000Z`),
          arrivalTime: new Date(found.arrivalAt ?? `${input.date}T${found.arrival}:00.000Z`),
          price: found.price,
          carrierPhones: found.carrierPhones ?? null,
          carrierBus: found.carrierBus ?? null,
          carrierFromPlace: found.fromStation ?? null,
          carrierToPlace: found.toStation ?? null,
          carrierFromMap: found.fromMap ?? null,
          carrierToMap: found.toMap ?? null,
          transportType: found.transportType ?? grandesTourCarrierAdapter.transportType,
          carrierId: legTrip.carrierId,
        },
      });
      await updateTicketVersioned(tx, ticket.id, ticket.version, {
        ...(leg === "return"
          ? { returnTripId: trip.id, returnSeatNumber: input.seatNumber }
          : { tripId: trip.id, seatNumber: input.seatNumber }),
        carrierRef: fresh.ref,
        ...(paid
          ? {}
          : {
              basePrice: fresh.priceBeforeDiscount,
              finalPrice: price,
              ...(percent != null
                ? {
                    commissionAmount: round2((fare * percent) / 100 + ticket.serviceFee),
                    carrierAmount: round2(fare - (fare * percent) / 100),
                  }
                : {}),
            }),
      });
      if (!paid) await tx.booking.update({ where: { id: booking.id }, data: { finalPrice: price } });
      await recordTicketHistory(tx, {
        ticketId: ticket.id,
        action: "TRIP_CHANGED",
        source: input.source,
        changedBy: input.changedBy,
        request: input.request,
        changes: {
          ...(leg === "return" ? { leg: { from: null, to: "return" } } : {}),
          [leg === "return" ? "returnTripId" : "tripId"]: { from: legTrip.id, to: trip.id },
          departure: { from: legTrip.departureTime.toISOString(), to: trip.departureTime.toISOString() },
          seatNumber: { from: oldSeat, to: input.seatNumber },
          carrierRef: { from: ticket.carrierRef, to: fresh.ref },
          ...(price !== ticket.finalPrice ? { finalPrice: { from: ticket.finalPrice, to: price } } : {}),
          ...(paid ? { carrierFare: { from: null, to: fare } } : {}),
        },
      });
    });
  } catch (err) {
    if (!back) {
      // Our side failed: give the new seat back to GT, the old ticket stays as it was.
      await gtCancelTicket(fresh.ref).catch(() => undefined);
    } else {
      // The old round trip is already cancelled: keep at least the new GT ticket on ours.
      await prisma.ticket.update({ where: { id: ticket.id }, data: { carrierRef: fresh.ref } }).catch(() => undefined);
      await notifyStaff({
        kind: "carrier_sync_failed",
        title: `Перевірте квиток ${booking.reference}: зміна в Grandes Tour пройшла, у нас — ні`,
        body: `Новий квиток GT ${fresh.ref}: ${leg === "return" ? "назад" : "туди"} ${input.date}, місце ${input.seatNumber}`,
        link: `/cabinet/tickets/${booking.reference}`,
      }).catch(() => undefined);
    }
    throw err;
  }

  if (!back) scheduleCarrierCancel(ticket.id, ticket.carrierRef);
  return { price, oldPrice: ticket.finalPrice };
}
