import { NextResponse, type NextRequest } from "next/server";
import { AgeCategory, Prisma, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { findCarrier } from "@/lib/carriers/registry";
import { requireAuth } from "@/lib/auth/guard";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { computePrice, type AgeCategoryId } from "@/lib/pricing";
import { PromoError, validatePromo } from "@/lib/promo";
import { DiscountCardError, validateDiscountCard } from "@/lib/discountCards";
import { maybeGrantReferralReward } from "@/lib/referrals";
import { recordTicketHistory, requestMeta } from "@/lib/tickets/history";
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
  /** Mutually exclusive with promoCode — see Booking.discountCardCode doc comment. */
  discountCardCode?: string;
  tripSnapshot?: Partial<Trip> & { date?: string };
  /** Seat picked in the seat-selection step (components/SeatMap.tsx). Optional
   * for backward compatibility with clients that skip that step. */
  seat?: { number?: number };
};

/** Thrown when the requested seat (or, with no seat requested, any seat) is
 * no longer AVAILABLE by the time we try to claim it inside the transaction —
 * someone else booked it first. Mapped to 409 outside the transaction. */
class SeatConflictError extends Error {}

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
  const isStaffBooking = hasRoleAtLeast(session.role, "AGENT");

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

  const carrierAdapterId = body.carrierId ?? "mock";
  const adapter = findCarrier(carrierAdapterId);
  if (!adapter) {
    return NextResponse.json(
      { error: `Unknown carrier: ${carrierAdapterId}` },
      { status: 400 }
    );
  }

  if (!body.tripId) {
    return NextResponse.json(
      { error: "`tripId` is required" },
      { status: 400 }
    );
  }

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
  // trusted from the client — the original code took `tripSnapshot.price`
  // (and the rest of the snapshot) straight from the request body, so any
  // caller could book a real trip at an arbitrary price (e.g. `price: 0.01`)
  // by editing the JSON they sent. We re-derive the canonical trip from the
  // same carrier adapter `/api/search` uses, keyed by `tripId`, and use only
  // that server-side data for pricing, the carrier/trip rows, and the
  // adapter booking call. The client-supplied snapshot is used only to know
  // which route to re-search and to carry the user-picked calendar date
  // (which the mock trip type doesn't include).
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
  const snapshot: Trip & { date?: string } = {
    ...canonicalTrip,
    date: clientSnapshot.date,
  };

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
  const rawDiscountCardCode = body.discountCardCode?.trim() || null;
  if (rawPromoCode && rawDiscountCardCode) {
    return NextResponse.json(
      { error: "Use either a promo code or a discount card, not both" },
      { status: 400 }
    );
  }

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

  let validatedCard = null as Awaited<ReturnType<typeof validateDiscountCard>> | null;
  if (rawDiscountCardCode) {
    try {
      validatedCard = await validateDiscountCard(prisma, {
        rawCode: rawDiscountCardCode,
        currentUserId: session.sub,
      });
    } catch (err) {
      if (err instanceof DiscountCardError) {
        return NextResponse.json(
          { error: err.message, reason: err.reason },
          { status: 400 }
        );
      }
      throw err;
    }
  }

  const pricing = computePrice(
    snapshot.price,
    passenger.ageCategory as AgeCategoryId,
    validatedPromo,
    validatedCard
  );
  const basePrice = pricing.basePrice;
  const finalPrice = pricing.finalPrice;
  const appliedPromoCode = validatedPromo?.code ?? null;
  const appliedPromoId = validatedPromo?.id ?? null;
  const appliedCardCode = validatedCard?.code ?? null;
  const appliedCardId = validatedCard?.id ?? null;

  // Only bother computing a commission snapshot for staff bookings whose
  // account actually has a rate configured — most agents won't have one set
  // and null is the correct "no commission" value on the ticket.
  let commissionAmount: number | null = null;
  if (isStaffBooking) {
    const bookedByUser = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { commissionType: true, commissionValue: true },
    });
    if (bookedByUser?.commissionType && bookedByUser.commissionValue != null) {
      commissionAmount =
        bookedByUser.commissionType === "FIXED"
          ? bookedByUser.commissionValue
          : Math.round(finalPrice * bookedByUser.commissionValue * 100) / 100;
    }
  }

  const departureAt = combineDateTime(snapshot.date, snapshot.departure);
  const arrivalAt = combineDateTime(snapshot.date, snapshot.arrival);
  if (arrivalAt <= departureAt) {
    arrivalAt.setUTCDate(arrivalAt.getUTCDate() + 1);
  }

  // Persist carrier, trip, seat claim, ticket, and booking in one transaction.
  try {
    const reference = generateReference();
    const created = await prisma.$transaction(async (tx) => {
      // A trip generated from a Route template (lib/routes/generate.ts)
      // already exists as a shared row with its own Seat inventory — reuse
      // it so capacity is enforced across every booking against it, instead
      // of each booking creating its own private Trip (which is what made
      // overbooking possible before Route templates existed). Only trips
      // still coming from the legacy in-memory mock generator
      // (lib/mockTrips.ts — no Route template behind them) fall back to the
      // old "create a fresh Trip row" behavior, since they have no shared
      // row or seat inventory to claim from.
      const existingTrip = await tx.trip.findUnique({
        where: { id: body.tripId },
      });

      const carrier = existingTrip
        ? await tx.carrier.findUniqueOrThrow({ where: { id: existingTrip.carrierId } })
        : await tx.carrier.upsert({
            where: { name: snapshot.carrier ?? adapter.name },
            update: {},
            create: {
              name: snapshot.carrier ?? adapter.name,
              rating: snapshot.rating ?? 0,
            },
          });

      const trip =
        existingTrip ??
        (await tx.trip.create({
          data: {
            fromCity: snapshot.from!,
            toCity: snapshot.to!,
            departureTime: departureAt,
            arrivalTime: arrivalAt,
            price: basePrice,
            carrierId: carrier.id,
          },
        }));

      const ticket = await tx.ticket.create({
        data: {
          userId: session.sub,
          // Staff (AGENT/ADMIN/SUPER_ADMIN) booking while signed in is
          // attributed as an agent-made booking for reporting — the ticket
          // is still owned by `userId` above.
          bookedByUserId: isStaffBooking ? session.sub : null,
          commissionAmount,
          paymentMethod: isStaffBooking ? null : "ONLINE",
          tripId: trip.id,
          status: TicketStatus.RESERVED,
          basePrice,
          finalPrice,
        },
      });

      // Referral reward: if this ticket's owner was referred by someone and
      // this is their first ticket ever, grant the referrer a reward
      // discount card. Runs in-transaction so the reward and the booking
      // commit atomically.
      await maybeGrantReferralReward(tx, session.sub);

      // Claim a real seat when this trip has persisted inventory (i.e. it
      // came from a Route template). The conditional `updateMany` (status
      // must still be AVAILABLE) is the actual double-booking guard: if two
      // requests race for the same seat, only one matches and updates a row;
      // the loser gets `count: 0` and we throw SeatConflictError, which
      // rolls back this entire transaction (ticket/booking included) and
      // maps to a 409 outside it. Trips with no seat rows (legacy mock
      // trips) skip this — there's no inventory to enforce there.
      const requestedSeatNumber = body.seat?.number;
      const hasSeatInventory = (await tx.seat.count({ where: { tripId: trip.id } })) > 0;
      if (hasSeatInventory) {
        const seatNumber =
          requestedSeatNumber ??
          (
            await tx.seat.findFirst({
              where: { tripId: trip.id, status: "AVAILABLE" },
              orderBy: { number: "asc" },
              select: { number: true },
            })
          )?.number;

        if (seatNumber == null) {
          throw new SeatConflictError("This trip is fully booked.");
        }

        const claim = await tx.seat.updateMany({
          where: { tripId: trip.id, number: seatNumber, status: "AVAILABLE" },
          data: { status: "BOOKED", ticketId: ticket.id },
        });
        if (claim.count === 0) {
          throw new SeatConflictError(
            requestedSeatNumber != null
              ? `Seat ${seatNumber} was just booked by someone else. Please pick another seat.`
              : "This trip is fully booked."
          );
        }
      }

      const booking = await tx.booking.create({
        data: {
          reference,
          firstName: passenger.firstName,
          lastName: passenger.lastName,
          ageCategory: passenger.ageCategory,
          phone: passenger.phone,
          email: accountEmail,
          promoCode: appliedPromoCode,
          discountCardCode: appliedCardCode,
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
      // Discount cards have no usage cap (unlike Promo) — just a plain
      // increment for reporting, no concurrency guard needed.
      if (appliedCardId) {
        await tx.discountCard.update({
          where: { id: appliedCardId },
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
        source: isStaffBooking ? "AGENT_BOOKING" : "BOOKING_FORM",
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
        },
      });

      return { carrier, trip, ticket, booking };
    });

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
          discountCardCode: created.booking.discountCardCode ?? undefined,
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
          basePrice: created.ticket.basePrice,
          finalPrice: created.booking.finalPrice,
          priceBreakdown: {
            basePrice: pricing.basePrice,
            ageDiscount: pricing.ageDiscount,
            promoDiscount: pricing.promoDiscount,
            promoCode: appliedPromoCode,
            discountCardAmount: pricing.discountCardAmount,
            discountCardCode: appliedCardCode,
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
    if (err instanceof SeatConflictError) {
      return NextResponse.json(
        { error: err.message, reason: "seat_unavailable" },
        { status: 409 }
      );
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
