import { prisma } from "@/lib/db";
import { grandesTourCarrierAdapter } from "@/lib/carriers/grandes-tour";
import { gtCancelTicket, gtLegFromKey, gtRefParts, gtTicketPassenger } from "@/lib/carriers/grandes-tour/pricing";
import { scheduleCarrierCancel } from "@/lib/tickets/carrierSync";
import { recordTicketHistory, type RequestMeta, type TicketHistorySource } from "@/lib/tickets/history";
import { updateTicketVersioned } from "@/lib/tickets/version";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Why a Grandes Tour ticket's date or seat can't be changed here (null = it can). */
export function gtChangeBlocked(ticket: { status: string; tripKind: string }): string | null {
  if (ticket.tripKind !== "ONE_WAY") return "Квиток туди-назад Grandes Tour поки що змінюють у Grandes Tour вручну";
  if (ticket.status === "CANCELLED" || ticket.status === "REFUNDED") return "Квиток скасовано";
  return null;
}

export class GtChangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GtChangeError";
  }
}

/**
 * Moves a Grandes Tour ticket to another departure (or another seat): GT has
 * no "change", so the same passenger (fare type, card) is reserved on the new
 * trip first, our ticket follows (trip, seat, GT ticket, price), and only then
 * the old GT ticket is cancelled. Nothing changes when the new reservation
 * fails; a failed cancel of the old one is reported to staff.
 * A paid ticket keeps its paid price (the carrier's new price is noted in the
 * history); an unpaid one takes the new price. One-way tickets — callers check.
 */
export async function changeGtTicketTrip(input: {
  ticketId: string;
  tripKey: string;
  date: string;
  seatNumber: number;
  changedBy: string | null;
  source: TicketHistorySource;
  request?: RequestMeta;
}): Promise<{ price: number; oldPrice: number }> {
  const ticket = await prisma.ticket.findUnique({ where: { id: input.ticketId }, include: { trip: true } });
  const booking = await prisma.booking.findFirst({ where: { ticketId: input.ticketId } });
  const old = gtRefParts(ticket?.carrierRef);
  if (!ticket || !booking || !ticket.trip || !old) throw new GtChangeError("Це не квиток Grandes Tour");
  if (!gtLegFromKey(input.tripKey) || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new GtChangeError("Невідомий рейс");

  const found = (
    await grandesTourCarrierAdapter.search({ from: ticket.trip.fromCity, to: ticket.trip.toCity, date: input.date })
  ).find((t) => t.id === input.tripKey);
  if (!found) throw new GtChangeError("Рейс не знайдено — оновіть список рейсів");

  const passenger = await gtTicketPassenger(old.orderId, old.ticketId);
  const reserved = await grandesTourCarrierAdapter.book({
    tripId: input.tripKey,
    carrierId: grandesTourCarrierAdapter.id,
    passenger: { name: `${booking.firstName} ${booking.lastName}`.trim(), phone: booking.phone },
    passengers: [
      {
        name: `${booking.firstName} ${booking.lastName}`.trim(),
        phone: booking.phone,
        fareTypeId: passenger.passengerTypeId,
        seatNumber: input.seatNumber,
      },
    ],
    tripSnapshot: { ...found, currency: "EUR" },
    travelDate: input.date,
    discountCard: passenger.discountCard,
    paymentAtBoarding: ticket.status !== "AWAITING_PAYMENT",
  });
  const fresh = reserved.tickets?.[0];
  if (!fresh || !gtRefParts(fresh.ref)) throw new GtChangeError("Grandes Tour не повернув номер нового квитка");

  const fare = fresh.price;
  const paid = ticket.status === "PAID_ONLINE" || ticket.status === "PAID_CASH";
  const price = paid ? ticket.finalPrice : round2(fare + ticket.serviceFee);
  const percent = ticket.commissionPercent;
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
          transportType: found.transportType ?? grandesTourCarrierAdapter.transportType,
          carrierId: ticket.trip!.carrierId,
        },
      });
      await updateTicketVersioned(tx, ticket.id, ticket.version, {
        tripId: trip.id,
        seatNumber: input.seatNumber,
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
          tripId: { from: ticket.tripId, to: trip.id },
          departure: { from: ticket.trip!.departureTime.toISOString(), to: trip.departureTime.toISOString() },
          seatNumber: { from: ticket.seatNumber, to: input.seatNumber },
          carrierRef: { from: ticket.carrierRef, to: fresh.ref },
          ...(price !== ticket.finalPrice ? { finalPrice: { from: ticket.finalPrice, to: price } } : {}),
          ...(paid ? { carrierFare: { from: null, to: fare } } : {}),
        },
      });
    });
  } catch (err) {
    // Our side failed: give the new seat back to GT, the old ticket stays as it was.
    await gtCancelTicket(fresh.ref).catch(() => undefined);
    throw err;
  }

  scheduleCarrierCancel(ticket.id, ticket.carrierRef);
  return { price, oldPrice: ticket.finalPrice };
}
