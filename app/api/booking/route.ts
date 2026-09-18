import { NextResponse, type NextRequest } from "next/server";
import { AgeCategory, Prisma, TicketStatus, TripKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { findCarrier } from "@/lib/carriers/registry";
import { requireAuth } from "@/lib/auth/guard";
import { computePrice, type AgeCategoryId } from "@/lib/pricing";
import { PromoError, validatePromo } from "@/lib/promo";
import { recordTicketHistory, requestMeta } from "@/lib/tickets/history";
import { parseTripKind } from "@/lib/tickets/kinds";
import { uniqueReference } from "@/lib/tickets/reference";
import { can } from "@/lib/auth/permissions";
import {
  SeatHeldError,
  SeatRequiredError,
  SeatTakenError,
  assertSeatAvailable,
  releaseSessionHolds,
  seatPriceMultiplier,
} from "@/lib/tickets/inventory";
import { applyOnlineDiscount, getSiteSettings } from "@/lib/settings";
import { priceForTrip, soldSeatCount } from "@/lib/pricing/grid";
import { notifyNewBooking, notifyTripAlmostFull } from "@/lib/notify";
import { FULL_ROUTE, resolveSegment, type Segment } from "@/lib/trips/segments";
import { cityNames } from "@/lib/trips/cities";
import type { BookingPassenger, Trip } from "@/lib/carriers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PassengerPayload = Partial<BookingPassenger> & {
  firstName?: string;
  lastName?: string;
  ageCategory?: AgeCategory | string;
};

type PassengerInput = PassengerPayload & {
  promoCode?: string;
  seatNumber?: number | null;
  returnSeatNumber?: number | null;
};

type CreateBookingBody = {
  tripId?: string;
  carrierId?: string;
  tripSnapshot?: Partial<Trip> & { date?: string };
  tripKind?: string;
  returnTripId?: string;
  paymentMethod?: string;
  holdSessionId?: string;
  contact?: { phone?: string; email?: string };
  passengers?: PassengerInput[];
  // Legacy single-passenger shape (still accepted).
  passenger?: PassengerPayload;
  promoCode?: string;
  seatNumber?: number | null;
  returnSeatNumber?: number | null;
};

const SERVICE_FEE_EUR = 1.5;
const MAX_PASSENGERS = 6;

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "-" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

type ResolvedPassenger = {
  firstName: string;
  lastName: string;
  ageCategory: AgeCategory;
  promoCode?: string;
  seatNumber?: number | null;
  returnSeatNumber?: number | null;
};

function resolvePassenger(p?: PassengerInput): ResolvedPassenger {
  if (!p) throw new ValidationError("Пасажир обовʼязковий");

  let firstName = p.firstName?.trim() ?? "";
  let lastName = p.lastName?.trim() ?? "";
  if ((!firstName || !lastName) && p.name) {
    const split = splitName(p.name);
    firstName = firstName || split.firstName;
    lastName = lastName || split.lastName;
  }
  if (firstName.length < 1) throw new ValidationError("Вкажіть імʼя");
  if (lastName.length < 1) throw new ValidationError("Вкажіть прізвище");

  const ageCategory = p.ageCategory;
  if (!ageCategory) throw new ValidationError("Вкажіть вікову категорію");
  if (!(ageCategory in AgeCategory)) {
    throw new ValidationError(
      "Вікова категорія: CHILD_0_4, CHILD_5_12, ADULT, SENIOR_60"
    );
  }

  return {
    firstName,
    lastName,
    ageCategory: ageCategory as AgeCategory,
    promoCode: p.promoCode?.trim() || undefined,
    seatNumber: p.seatNumber ?? null,
    returnSeatNumber: p.returnSeatNumber ?? null,
  };
}

function hhmm(date: Date): string {
  return date.toISOString().slice(11, 16);
}

function sameCity(a: string, b: string): boolean {
  const left = cityNames(a).map((name) => name.toLowerCase());
  const right = cityNames(b).map((name) => name.toLowerCase());
  return left.some((name) => right.includes(name));
}

function combineDateTime(dateStr: string | undefined, time: string): Date {
  const base = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : new Date();
  if (Number.isNaN(base.getTime())) return new Date();
  const [h, m] = time.split(":").map((v) => Number.parseInt(v, 10) || 0);
  const d = new Date(base);
  d.setUTCHours(h, m, 0, 0);
  return d;
}

export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;
  const { session } = guard;
  const meta = requestMeta(req);

  const account = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { email: true },
  });
  if (!account) {
    return NextResponse.json(
      { error: "Authenticated user not found" },
      { status: 401 }
    );
  }
  const accountEmail = account.email;

  let body: CreateBookingBody;
  try {
    body = (await req.json()) as CreateBookingBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.tripId) {
    return NextResponse.json({ error: "`tripId` is required" }, { status: 400 });
  }

  const storedTrip = await prisma.trip.findUnique({
    where: { id: body.tripId },
    include: { carrier: true, departure: true },
  });

  const carrierAdapterId = body.carrierId ?? (storedTrip ? "asol" : "mock");
  const adapter = findCarrier(carrierAdapterId) ?? findCarrier("asol");
  if (!adapter) {
    return NextResponse.json(
      { error: `Unknown carrier: ${carrierAdapterId}` },
      { status: 400 }
    );
  }

  const tripKind = parseTripKind(body.tripKind);
  const paymentMethod =
    body.paymentMethod === "ONLINE" ? "ONLINE" : "CASH_ON_BUS";
  const holdSessionId = body.holdSessionId?.trim() || undefined;
  const siteSettings = await getSiteSettings();

  if (!(await can({ role: session.role }, "booking.create"))) {
    return NextResponse.json(
      { error: "Немає дозволу booking.create" },
      { status: 403 }
    );
  }

  const rawPassengers: PassengerInput[] = body.passengers?.length
    ? body.passengers
    : [
        {
          ...body.passenger,
          promoCode: body.promoCode,
          seatNumber: body.seatNumber,
          returnSeatNumber: body.returnSeatNumber,
        },
      ];
  if (rawPassengers.length > MAX_PASSENGERS) {
    return NextResponse.json(
      { error: `Максимум ${MAX_PASSENGERS} пасажирів за одне бронювання` },
      { status: 400 }
    );
  }

  const phone = (body.contact?.phone ?? body.passenger?.phone ?? "").trim();
  if (phone.replace(/\D/g, "").length < 7) {
    return NextResponse.json(
      { error: "Телефон має містити щонайменше 7 цифр" },
      { status: 400 }
    );
  }

  let passengers: ResolvedPassenger[];
  try {
    passengers = rawPassengers.map(resolvePassenger);
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const adapterPassenger: BookingPassenger = {
    name: `${passengers[0].firstName} ${passengers[0].lastName}`.trim(),
    phone,
    email: accountEmail,
  };

  const clientSnapshot = body.tripSnapshot ?? {};
  if (!clientSnapshot.from || !clientSnapshot.to) {
    return NextResponse.json(
      { error: "`tripSnapshot` must include from and to" },
      { status: 400 }
    );
  }

  // SECURITY: price, departure/arrival, carrier and currency must NEVER be
  // trusted from the client. Prisma trips are reused by id so seats bind to
  // the real departure. Mock ids still go through the carrier adapter search.
  let snapshot: Trip & { date?: string };
  if (storedTrip) {
    snapshot = {
      id: storedTrip.id,
      carrierId: carrierAdapterId,
      carrier: storedTrip.carrier.name,
      carrierShort: storedTrip.carrier.name.slice(0, 2).toUpperCase(),
      busType: storedTrip.departure?.defaultBus ?? "Coach",
      from: storedTrip.fromCity,
      to: storedTrip.toCity,
      departure: hhmm(storedTrip.departureTime),
      arrival: hhmm(storedTrip.arrivalTime),
      durationMinutes: Math.max(
        1,
        Math.round(
          (storedTrip.arrivalTime.getTime() - storedTrip.departureTime.getTime()) /
            60000
        )
      ),
      price: storedTrip.price,
      currency: "EUR",
      seatsLeft: 46,
      amenities: [],
      rating: storedTrip.carrier.rating,
      hasAssignedSeats: storedTrip.departure?.hasAssignedSeats !== false,
      date: storedTrip.departureTime.toISOString().slice(0, 10),
    };
  } else {
    const canonicalTrips = await adapter.search({
      from: String(clientSnapshot.from),
      to: String(clientSnapshot.to),
    });
    const canonicalTrip = canonicalTrips.find((t) => t.id === body.tripId);
    if (!canonicalTrip) {
      return NextResponse.json(
        {
          error:
            "Trip not found for this route. Please search again — prices and availability may have changed.",
        },
        { status: 409 }
      );
    }
    snapshot = { ...canonicalTrip, date: clientSnapshot.date };
  }

  let returnStoredTrip: typeof storedTrip = null;
  if (tripKind === "ROUND_TRIP") {
    if (!body.returnTripId) {
      return NextResponse.json(
        { error: "Оберіть зворотній рейс" },
        { status: 400 }
      );
    }
    returnStoredTrip = await prisma.trip.findUnique({
      where: { id: body.returnTripId },
      include: { carrier: true, departure: true },
    });
    if (!returnStoredTrip) {
      return NextResponse.json(
        { error: "Зворотній рейс не знайдено" },
        { status: 404 }
      );
    }
    if (
      !sameCity(returnStoredTrip.fromCity, snapshot.to) ||
      !sameCity(returnStoredTrip.toCity, snapshot.from)
    ) {
      return NextResponse.json(
        { error: "Повернення має бути в зворотному напрямку" },
        { status: 400 }
      );
    }
  }

  let adapterResult;
  try {
    adapterResult = await adapter.book({
      tripId: body.tripId,
      carrierId: carrierAdapterId,
      passenger: adapterPassenger,
      tripSnapshot: snapshot,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Carrier booking failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }

  // Per-passenger promos are validated before the transaction; the usedCount
  // increment inside the transaction re-checks the limit atomically.
  const validatedPromos: (Awaited<ReturnType<typeof validatePromo>> | null)[] = [];
  try {
    for (const p of passengers) {
      validatedPromos.push(
        p.promoCode
          ? await validatePromo(prisma, {
              rawCode: p.promoCode,
              currentUserId: session.sub,
            })
          : null
      );
    }
  } catch (err) {
    if (err instanceof PromoError) {
      return NextResponse.json(
        { error: err.message, reason: err.reason },
        { status: 400 }
      );
    }
    throw err;
  }

  // Segment seat inventory: resolve the sold from→to to stop indices on the
  // departure so one seat can be resold on non-overlapping legs.
  let segment: Segment = FULL_ROUTE;
  let segmentCities: { fromCity: string; toCity: string } | null = null;
  if (storedTrip?.departure) {
    const seg = await resolveSegment(
      prisma,
      storedTrip.id,
      String(clientSnapshot.from),
      String(clientSnapshot.to)
    );
    if (seg) {
      segment = seg;
      segmentCities = {
        fromCity: String(clientSnapshot.from),
        toCity: String(clientSnapshot.to),
      };
    }
  }
  let returnSegment: Segment = FULL_ROUTE;
  if (returnStoredTrip?.departure) {
    const seg = await resolveSegment(
      prisma,
      returnStoredTrip.id,
      String(clientSnapshot.to),
      String(clientSnapshot.from)
    );
    if (seg) returnSegment = seg;
  }

  // Authoritative price: tariff grid of the departure's country when present
  // (tier by sold seat share × month multiplier × time phase), else the flat
  // trip price. Computed server-side — never trusted from the client.
  const outboundPricing = storedTrip
    ? await priceForTrip(prisma, storedTrip)
    : { price: snapshot.price, breakdown: null };
  const returnPricing = returnStoredTrip
    ? await priceForTrip(prisma, returnStoredTrip)
    : { price: 0, breakdown: null };
  const legsPrice = outboundPricing.price + returnPricing.price;
  if (storedTrip) snapshot.price = outboundPricing.price;
  const ticketStatus =
    paymentMethod === "ONLINE"
      ? TicketStatus.AWAITING_PAYMENT
      : TicketStatus.RESERVED;
  const ticketKind =
    tripKind === "OPEN_RETURN"
      ? TripKind.OPEN_RETURN
      : tripKind === "ROUND_TRIP"
        ? TripKind.ROUND_TRIP
        : TripKind.ONE_WAY;

  const departureAt = combineDateTime(snapshot.date, snapshot.departure);
  const arrivalAt = combineDateTime(snapshot.date, snapshot.arrival);
  if (arrivalAt <= departureAt) {
    arrivalAt.setUTCDate(arrivalAt.getUTCDate() + 1);
  }

  try {
    const groupSize = passengers.length;
    const created = await prisma.$transaction(async (tx) => {
      const carrier = storedTrip
        ? await tx.carrier.upsert({
            where: { name: storedTrip.carrier.name },
            update: {},
            create: {
              name: storedTrip.carrier.name,
              rating: storedTrip.carrier.rating,
            },
          })
        : await tx.carrier.upsert({
            where: { name: snapshot.carrier ?? adapter.name },
            update: {},
            create: {
              name: snapshot.carrier ?? adapter.name,
              rating: snapshot.rating ?? 0,
            },
          });

      const trip = storedTrip
        ? storedTrip
        : await tx.trip.create({
            data: {
              fromCity: snapshot.from!,
              toCity: snapshot.to!,
              departureTime: departureAt,
              arrivalTime: arrivalAt,
              price: snapshot.price,
              carrierId: carrier.id,
            },
          });

      const groupRef = groupSize > 1 ? await uniqueReference(tx) : null;
      const items: Array<{
        ticket: Awaited<ReturnType<typeof tx.ticket.create>>;
        booking: Awaited<ReturnType<typeof tx.booking.create>>;
        fullPrice: number;
      }> = [];

      for (let i = 0; i < passengers.length; i += 1) {
        const p = passengers[i];
        const seatMult = await seatPriceMultiplier(tx, trip.id, p.seatNumber ?? null);
        const paxLegsPrice =
          seatMult !== 1
            ? Math.round(legsPrice * seatMult * 100) / 100
            : legsPrice;
        const pricing = computePrice(
          paxLegsPrice,
          p.ageCategory as AgeCategoryId,
          validatedPromos[i]
        );
        const fullPrice = pricing.finalPrice;
        const finalPrice =
          paymentMethod === "ONLINE"
            ? applyOnlineDiscount(fullPrice, siteSettings)
            : fullPrice;

        const outboundSeat = await assertSeatAvailable(
          tx,
          trip.id,
          p.seatNumber,
          undefined,
          holdSessionId,
          segment
        );
        let returnSeat: number | null = null;
        if (tripKind === "ROUND_TRIP" && returnStoredTrip) {
          returnSeat = await assertSeatAvailable(
            tx,
            returnStoredTrip.id,
            p.returnSeatNumber,
            undefined,
            holdSessionId,
            returnSegment
          );
        }

        const ticket = await tx.ticket.create({
          data: {
            userId: session.sub,
            tripId: trip.id,
            status: ticketStatus,
            basePrice: pricing.basePrice,
            finalPrice,
            seatNumber: outboundSeat,
            fromStopIndex: segmentCities ? segment.fromIndex : null,
            toStopIndex: segmentCities ? segment.toIndex : null,
            fromCity: segmentCities?.fromCity ?? null,
            toCity: segmentCities?.toCity ?? null,
            tripKind: ticketKind,
            returnTripId: returnStoredTrip?.id ?? null,
            returnSeatNumber: returnSeat,
          },
        });

        const reference =
          groupRef && i === 0 ? groupRef : await uniqueReference(tx);
        const booking = await tx.booking.create({
          data: {
            reference,
            groupRef,
            firstName: p.firstName,
            lastName: p.lastName,
            ageCategory: p.ageCategory,
            phone,
            email: accountEmail,
            promoCode: validatedPromos[i]?.code ?? null,
            finalPrice,
            ticketId: ticket.id,
          },
        });

        const promo = validatedPromos[i];
        if (promo) {
          const baseWhere: Prisma.PromoWhereUniqueInput & {
            isActive?: boolean;
            usedCount?: { lt: number };
          } = { id: promo.id, isActive: true };
          if (promo.usageLimit != null) {
            baseWhere.usedCount = { lt: promo.usageLimit };
          }
          await tx.promo.update({
            where: baseWhere as Prisma.PromoWhereUniqueInput,
            data: { usedCount: { increment: 1 } },
          });
        }

        await recordTicketHistory(tx, {
          ticketId: ticket.id,
          action: "CREATED",
          oldStatus: null,
          newStatus: ticket.status,
          source: "BOOKING_FORM",
          changedBy: session.sub,
          request: meta,
          changes: {
            reference: { from: null, to: booking.reference },
            status: { from: null, to: ticket.status },
            basePrice: { from: null, to: ticket.basePrice },
            finalPrice: { from: null, to: ticket.finalPrice },
            passenger: {
              from: null,
              to: {
                firstName: booking.firstName,
                lastName: booking.lastName,
                ageCategory: booking.ageCategory,
                phone: booking.phone,
                email: booking.email,
              },
            },
            promoCode: { from: null, to: booking.promoCode },
            paymentMethod: { from: null, to: paymentMethod },
            trip: {
              from: null,
              to: {
                from: trip.fromCity,
                to: trip.toCity,
                departure: trip.departureTime,
                arrival: trip.arrivalTime,
                carrier: carrier.name,
              },
            },
            tripKind: { from: null, to: tripKind },
            seatNumber: { from: null, to: outboundSeat },
            returnTripId: { from: null, to: returnStoredTrip?.id ?? null },
            returnSeatNumber: { from: null, to: returnSeat },
            tariff: {
              from: null,
              to: outboundPricing.breakdown
                ? {
                    tier: outboundPricing.breakdown.tierIndex + 1,
                    tierPrice: outboundPricing.breakdown.tierPrice,
                    monthMultiplier: outboundPricing.breakdown.monthMultiplier,
                    phase: outboundPricing.breakdown.phase,
                  }
                : "flat",
            },
          },
        });

        if (outboundSeat != null) {
          await recordTicketHistory(tx, {
            ticketId: ticket.id,
            action: "SEAT_HELD",
            source: "BOOKING_FORM",
            changedBy: session.sub,
            request: meta,
            timestamp: new Date(Date.now() + 1000),
            changes: { seatNumber: { from: null, to: outboundSeat } },
          });
        }
        if (promo) {
          await recordTicketHistory(tx, {
            ticketId: ticket.id,
            action: "PROMO_APPLIED",
            source: "BOOKING_FORM",
            changedBy: session.sub,
            request: meta,
            timestamp: new Date(Date.now() + 2000),
            changes: { promoCode: { from: null, to: promo.code } },
          });
        }

        items.push({ ticket, booking, fullPrice });
      }

      return { carrier, trip, items, groupRef };
    });

    if (holdSessionId) {
      await releaseSessionHolds(prisma, holdSessionId, [
        created.trip.id,
        ...(returnStoredTrip ? [returnStoredTrip.id] : []),
      ]);
    }

    // Notification Center + mock email — the timeline shows the full story.
    const firstRef = created.items[0].booking.reference;
    await notifyNewBooking(
      firstRef,
      `${created.trip.fromCity} → ${created.trip.toCity} · ${created.items.length} пас.`,
    );
    for (const item of created.items) {
      await recordTicketHistory(prisma, {
        ticketId: item.ticket.id,
        action: "EMAIL_SENT",
        source: "SYSTEM",
        timestamp: new Date(Date.now() + 3000),
        changes: { email: { from: null, to: item.booking.email ?? accountEmail } },
      });
    }
    const soldNow = await soldSeatCount(prisma, created.trip.id);
    const gridCapacity = outboundPricing.breakdown ? 46 : 46;
    if (soldNow / gridCapacity >= 0.85) {
      await notifyTripAlmostFull(
        `${created.trip.fromCity} → ${created.trip.toCity} · ${created.trip.departureTime.toISOString().slice(0, 10)}`,
        soldNow / gridCapacity
      );
    }

    if (paymentMethod === "ONLINE") {
      const deadlineAt = new Date(
        Date.now() + siteSettings.paymentDeadlineHours * 3_600_000
      );
      for (const item of created.items) {
        await prisma.payment.create({
          data: {
            ticketId: item.ticket.id,
            amount: item.ticket.finalPrice,
            fullAmount: item.fullPrice,
            deadlineAt,
          },
        });
        await recordTicketHistory(prisma, {
          ticketId: item.ticket.id,
          action: "PAYMENT_STARTED",
          source: "BOOKING_FORM",
          changedBy: session.sub,
          request: meta,
          changes: {
            amount: { from: null, to: item.ticket.finalPrice },
            deadlineAt: { from: null, to: deadlineAt },
          },
        });
      }
    }

    const first = created.items[0];
    const totalTickets = created.items.reduce(
      (sum, item) => sum + item.ticket.finalPrice,
      0
    );
    const totalPaid =
      Math.round((totalTickets + SERVICE_FEE_EUR * created.items.length) * 100) /
      100;
    const payRef = created.groupRef ?? first.booking.reference;

    return NextResponse.json(
      {
        booking: {
          id: first.booking.id,
          reference: first.booking.reference,
          groupRef: created.groupRef ?? undefined,
          status: first.ticket.status,
          createdAt: first.booking.createdAt,
          passenger: {
            firstName: first.booking.firstName,
            lastName: first.booking.lastName,
            ageCategory: first.booking.ageCategory,
            phone: first.booking.phone,
            email: first.booking.email ?? undefined,
          },
          passengers: created.items.map((item) => ({
            reference: item.booking.reference,
            firstName: item.booking.firstName,
            lastName: item.booking.lastName,
            ageCategory: item.booking.ageCategory,
            seatNumber: item.ticket.seatNumber,
            returnSeatNumber: item.ticket.returnSeatNumber,
            finalPrice: item.ticket.finalPrice,
          })),
          promoCode: first.booking.promoCode ?? undefined,
          trip: {
            from: created.trip.fromCity,
            to: created.trip.toCity,
            departure: snapshot.departure,
            arrival: snapshot.arrival,
            departureAt: created.trip.departureTime,
            arrivalAt: created.trip.arrivalTime,
            basePrice: first.ticket.basePrice,
            price: created.trip.price,
            currency: snapshot.currency ?? "EUR",
          },
          carrier: { id: created.carrier.id, name: created.carrier.name },
          tripKind: first.ticket.tripKind,
          seatNumber: first.ticket.seatNumber,
          returnTripId: first.ticket.returnTripId,
          returnSeatNumber: first.ticket.returnSeatNumber,
          paymentMethod,
          payment:
            paymentMethod === "ONLINE"
              ? {
                  amount: Math.round(totalTickets * 100) / 100,
                  deadlineAt: new Date(
                    Date.now() + siteSettings.paymentDeadlineHours * 3_600_000
                  ),
                  payUrl: `/pay/${payRef}`,
                }
              : undefined,
          basePrice: first.ticket.basePrice,
          finalPrice: first.booking.finalPrice,
          totalPaid,
        },
        carrierReference: adapterResult.carrierReference,
        fees: { service: SERVICE_FEE_EUR, currency: "EUR" },
      },
      { status: 201 }
    );
  } catch (err) {
    if (
      err instanceof SeatTakenError ||
      err instanceof SeatHeldError ||
      err instanceof SeatRequiredError
    ) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json(
        {
          error: "Promo code has reached its usage limit",
          reason: "usage_limit_reached",
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        error: "Failed to persist booking",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;
  const { session } = guard;

  const reference = req.nextUrl.searchParams.get("reference");

  if (reference) {
    const booking = await prisma.booking.findUnique({
      where: { reference },
      include: {
        ticket: {
          include: { trip: { include: { carrier: true } } },
        },
      },
    });
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (
      booking.ticket.userId !== session.sub &&
      session.role !== "ADMIN" &&
      session.role !== "SUPER_ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ booking });
  }

  const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
  const bookings = await prisma.booking.findMany({
    where: isAdmin ? {} : { ticket: { userId: session.sub } },
    include: {
      ticket: { include: { trip: { include: { carrier: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ bookings });
}
