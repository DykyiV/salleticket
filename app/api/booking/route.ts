import { NextResponse, type NextRequest } from "next/server";
import { AgeCategory, Prisma, TicketStatus, TripKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { findCarrier } from "@/lib/carriers/registry";
import { requireAuth } from "@/lib/auth/guard";
import { computePrice, type AgeCategoryId } from "@/lib/pricing";
import { PromoError, validatePromo } from "@/lib/promo";
import { recordTicketHistory, requestMeta } from "@/lib/tickets/history";
import { parseTripKind } from "@/lib/tickets/kinds";
import {
  SeatHeldError,
  SeatRequiredError,
  SeatTakenError,
  assertSeatAvailable,
  releaseSessionHolds,
} from "@/lib/tickets/inventory";
import { applyOnlineDiscount, getSiteSettings } from "@/lib/settings";
import { cityNames } from "@/lib/trips/cities";
import type { BookingPassenger, Trip } from "@/lib/carriers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PassengerPayload = Partial<BookingPassenger> & {
  firstName?: string;
  lastName?: string;
  ageCategory?: AgeCategory | string;
};

type CreateBookingBody = {
  tripId?: string;
  carrierId?: string;
  passenger?: PassengerPayload;
  promoCode?: string;
  tripSnapshot?: Partial<Trip> & { date?: string };
  tripKind?: string;
  seatNumber?: number | null;
  returnTripId?: string;
  returnSeatNumber?: number | null;
  paymentMethod?: string;
  holdSessionId?: string;
};

const SERVICE_FEE_EUR = 1.5;

/**
 * Split "First Last" into { firstName, lastName }. If only one token is given,
 * the last name defaults to a single dash so the column stays non-null; API
 * consumers that want a real split should send firstName + lastName directly.
 */
function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "-" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

type ResolvedPassenger = {
  firstName: string;
  lastName: string;
  ageCategory: AgeCategory;
  phone: string;
  email?: string;
};

/**
 * Thrown by validation helpers. The POST handler catches it and returns a
 * 400 with the message.
 */
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function resolvePassenger(p?: PassengerPayload): ResolvedPassenger {
  if (!p) throw new ValidationError("Passenger is required");

  let firstName = p.firstName?.trim() ?? "";
  let lastName = p.lastName?.trim() ?? "";
  if ((!firstName || !lastName) && p.name) {
    const split = splitName(p.name);
    firstName = firstName || split.firstName;
    lastName = lastName || split.lastName;
  }

  if (firstName.length < 1) {
    throw new ValidationError("First name is required");
  }
  if (lastName.length < 1) {
    throw new ValidationError("Last name is required");
  }

  const digits = (p.phone ?? "").replace(/\D/g, "");
  if (digits.length < 7) {
    throw new ValidationError("Phone must contain at least 7 digits");
  }
  if (p.email && !/^\S+@\S+\.\S+$/.test(p.email)) {
    throw new ValidationError("Email is not a valid address");
  }

  const ageCategory = p.ageCategory;
  if (!ageCategory) {
    throw new Error("Age category is required");
  }
  if (!(ageCategory in AgeCategory)) {
    throw new ValidationError(
      "Age category must be one of CHILD_0_4, CHILD_5_12, ADULT, SENIOR_60"
    );
  }

  return {
    firstName,
    lastName,
    ageCategory: ageCategory as AgeCategory,
    phone: (p.phone ?? "").trim(),
    email: p.email?.trim() || undefined,
  };
}

function generateReference(): string {
  return `AB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function hhmm(date: Date): string {
  return date.toISOString().slice(11, 16);
}

function sameCity(a: string, b: string): boolean {
  const left = cityNames(a).map((name) => name.toLowerCase());
  const right = cityNames(b).map((name) => name.toLowerCase());
  return left.some((name) => right.includes(name));
}

/**
 * Combine a YYYY-MM-DD date (or today) with a HH:MM time into a Date.
 * If arrival < departure, roll the arrival into the next day.
 */
function combineDateTime(
  dateStr: string | undefined,
  time: string
): Date {
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

  // Email is authoritative from the users table — if a userId exists the
  // email stored against the booking always matches the account, regardless
  // of what the client sends in passenger.email.
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
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.tripId) {
    return NextResponse.json(
      { error: "`tripId` is required" },
      { status: 400 }
    );
  }

  const storedTrip = await prisma.trip.findUnique({
    where: { id: body.tripId },
    include: { carrier: true, departure: true },
  });

  const carrierAdapterId =
    body.carrierId ?? (storedTrip ? "asol" : "mock");
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

  let passenger: ResolvedPassenger;
  try {
    passenger = resolvePassenger(body.passenger);
  } catch (err) {
    if (err instanceof ValidationError || err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  // Snapshot shape for downstream carrier adapter (still expects { name, ... }).
  // NOTE: we deliberately drop any passenger.email coming from the client —
  // the canonical email is the one on the authenticated user's account.
  const adapterPassenger: BookingPassenger = {
    name: `${passenger.firstName} ${passenger.lastName}`.trim(),
    phone: passenger.phone,
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
          (storedTrip.arrivalTime.getTime() -
            storedTrip.departureTime.getTime()) /
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
    snapshot = {
      ...canonicalTrip,
      date: clientSnapshot.date,
    };
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

  // Hand off to the carrier adapter first (real PNR / reservation).
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

  // Base price comes from the server-side canonical trip (re-fetched above).
  // Age-category discount + promo code are then applied so the client cannot
  // undercut the fare.
  //
  // We resolve the promo *outside* the transaction so invalid-code errors
  // short-circuit before we book anything. The usedCount increment inside
  // the transaction re-checks the usage limit atomically (optimistic concurrency).
  const rawPromoCode = body.promoCode?.trim() || null;
  let validatedPromo = null as Awaited<ReturnType<typeof validatePromo>> | null;
  if (rawPromoCode) {
    try {
      validatedPromo = await validatePromo(prisma, {
        rawCode: rawPromoCode,
        currentUserId: session.sub,
      });
    } catch (err) {
      if (err instanceof PromoError) {
        return NextResponse.json(
          { error: err.message, reason: err.reason },
          { status: 400 }
        );
      }
      throw err;
    }
  }

  const legsPrice = snapshot.price + (returnStoredTrip?.price ?? 0);
  const pricing = computePrice(
    legsPrice,
    passenger.ageCategory as AgeCategoryId,
    validatedPromo
  );
  const basePrice = pricing.basePrice;
  const fullPrice = pricing.finalPrice;
  // Online payment gets the configurable discount; paying on the bus doesn't.
  const finalPrice =
    paymentMethod === "ONLINE"
      ? applyOnlineDiscount(fullPrice, siteSettings)
      : fullPrice;
  const appliedPromoCode = validatedPromo?.code ?? null;
  const appliedPromoId = validatedPromo?.id ?? null;

  const departureAt = combineDateTime(snapshot.date, snapshot.departure);
  const arrivalAt = combineDateTime(snapshot.date, snapshot.arrival);
  if (arrivalAt <= departureAt) {
    arrivalAt.setUTCDate(arrivalAt.getUTCDate() + 1);
  }

  // Persist carrier, trip, ticket, and booking in one transaction.
  try {
    const reference = generateReference();
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

      const outboundSeat = await assertSeatAvailable(
        tx,
        trip.id,
        body.seatNumber,
        undefined,
        holdSessionId
      );
      let returnSeat: number | null = null;
      if (tripKind === "ROUND_TRIP" && returnStoredTrip) {
        returnSeat = await assertSeatAvailable(
          tx,
          returnStoredTrip.id,
          body.returnSeatNumber,
          undefined,
          holdSessionId
        );
      }

      const ticket = await tx.ticket.create({
        data: {
          userId: session.sub,
          tripId: trip.id,
          status:
            paymentMethod === "ONLINE"
              ? TicketStatus.AWAITING_PAYMENT
              : TicketStatus.RESERVED,
          basePrice,
          finalPrice,
          seatNumber: outboundSeat,
          tripKind:
            tripKind === "OPEN_RETURN"
              ? TripKind.OPEN_RETURN
              : tripKind === "ROUND_TRIP"
                ? TripKind.ROUND_TRIP
                : TripKind.ONE_WAY,
          returnTripId: returnStoredTrip?.id ?? null,
          returnSeatNumber: returnSeat,
        },
      });

      const booking = await tx.booking.create({
        data: {
          reference,
          firstName: passenger.firstName,
          lastName: passenger.lastName,
          ageCategory: passenger.ageCategory,
          phone: passenger.phone,
          email: accountEmail,
          promoCode: appliedPromoCode,
          finalPrice,
          ticketId: ticket.id,
        },
      });

      // Atomic usedCount increment with concurrency guard.
      // If another request just pushed the counter over the usageLimit, the
      // conditional update matches 0 rows and Prisma throws P2025, which we
      // turn into a clean 400 outside the transaction so the booking (and
      // any adapter side effects) rolls back.
      if (appliedPromoId) {
        const baseWhere: Prisma.PromoWhereUniqueInput & {
          isActive?: boolean;
          usedCount?: { lt: number };
        } = { id: appliedPromoId, isActive: true };
        if (validatedPromo?.usageLimit != null) {
          baseWhere.usedCount = { lt: validatedPromo.usageLimit };
        }
        await tx.promo.update({
          where: baseWhere as Prisma.PromoWhereUniqueInput,
          data: { usedCount: { increment: 1 } },
        });
      }

      // Audit trail: capture the initial snapshot of every user-visible
      // booking field as a from→to diff. Subsequent mutations (admin panel,
      // account cancel, carrier callback) append to the same table with
      // their own source + ip/ua + diff.
      await recordTicketHistory(tx, {
        ticketId: ticket.id,
        action: "CREATED",
        oldStatus: null,
        newStatus: ticket.status,
        source: "BOOKING_FORM",
        changedBy: session.sub,
        request: meta,
        changes: {
          reference:    { from: null, to: booking.reference },
          status:       { from: null, to: ticket.status },
          basePrice:    { from: null, to: ticket.basePrice },
          finalPrice:   { from: null, to: ticket.finalPrice },
          passenger: {
            from: null,
            to: {
              firstName:   booking.firstName,
              lastName:    booking.lastName,
              ageCategory: booking.ageCategory,
              phone:       booking.phone,
              email:       booking.email,
            },
          },
          promoCode: { from: null, to: booking.promoCode },
          paymentMethod: { from: null, to: paymentMethod },
          trip: {
            from: null,
            to: {
              from:      trip.fromCity,
              to:        trip.toCity,
              departure: trip.departureTime,
              arrival:   trip.arrivalTime,
              carrier:   carrier.name,
            },
          },
          tripKind: { from: null, to: tripKind },
          seatNumber: { from: null, to: outboundSeat },
          returnTripId: { from: null, to: returnStoredTrip?.id ?? null },
          returnSeatNumber: { from: null, to: returnSeat },
        },
      });

      return { carrier, trip, ticket, booking };
    });

    // The seat is now owned by the ticket — drop the session holds.
    if (holdSessionId) {
      await releaseSessionHolds(prisma, holdSessionId, [
        created.trip.id,
        ...(returnStoredTrip ? [returnStoredTrip.id] : []),
      ]);
    }

    let payment = null as {
      id: string;
      amount: number;
      deadlineAt: Date;
    } | null;
    if (paymentMethod === "ONLINE") {
      payment = await prisma.payment.create({
        data: {
          ticketId: created.ticket.id,
          amount: finalPrice,
          fullAmount: fullPrice,
          deadlineAt: new Date(
            Date.now() + siteSettings.paymentDeadlineHours * 3_600_000
          ),
        },
      });
      await recordTicketHistory(prisma, {
        ticketId: created.ticket.id,
        action: "PAYMENT_STARTED",
        source: "BOOKING_FORM",
        changedBy: session.sub,
        request: meta,
        changes: {
          amount: { from: null, to: payment.amount },
          deadlineAt: { from: null, to: payment.deadlineAt },
        },
      });
    }

    const totalPaid = finalPrice + SERVICE_FEE_EUR;

    return NextResponse.json(
      {
        booking: {
          id: created.booking.id,
          reference: created.booking.reference,
          status: created.ticket.status,
          createdAt: created.booking.createdAt,
          passenger: {
            firstName: created.booking.firstName,
            lastName: created.booking.lastName,
            ageCategory: created.booking.ageCategory,
            phone: created.booking.phone,
            email: created.booking.email ?? undefined,
          },
          promoCode: created.booking.promoCode ?? undefined,
          trip: {
            from: created.trip.fromCity,
            to: created.trip.toCity,
            departure: snapshot.departure,
            arrival: snapshot.arrival,
            departureAt: created.trip.departureTime,
            arrivalAt: created.trip.arrivalTime,
            basePrice: created.ticket.basePrice,
            price: created.trip.price,
            currency: snapshot.currency ?? "EUR",
          },
          carrier: {
            id: created.carrier.id,
            name: created.carrier.name,
          },
          tripKind: created.ticket.tripKind,
          seatNumber: created.ticket.seatNumber,
          returnTripId: created.ticket.returnTripId,
          returnSeatNumber: created.ticket.returnSeatNumber,
          paymentMethod,
          payment: payment
            ? {
                amount: payment.amount,
                deadlineAt: payment.deadlineAt,
                payUrl: `/pay/${created.booking.reference}`,
              }
            : undefined,
          basePrice: created.ticket.basePrice,
          finalPrice: created.booking.finalPrice,
          priceBreakdown: {
            basePrice: pricing.basePrice,
            ageDiscount: pricing.ageDiscount,
            promoDiscount: pricing.promoDiscount,
            promoCode: appliedPromoCode,
            finalPrice: pricing.finalPrice,
            serviceFee: pricing.serviceFee,
            total: pricing.total,
          },
          totalPaid: Math.round(totalPaid * 100) / 100,
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
    // P2025 = the conditional promo update matched 0 rows (concurrency race
    // against usedCount / isActive). Surface a clean 400 rather than 500.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025" &&
      appliedPromoId
    ) {
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
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }
    // A non-admin user may only read their own bookings.
    if (
      booking.ticket.userId !== session.sub &&
      session.role !== "ADMIN" &&
      session.role !== "SUPER_ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ booking });
  }

  // List bookings for the current user (or all, for admins).
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
