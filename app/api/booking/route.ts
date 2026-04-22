import { NextResponse, type NextRequest } from "next/server";
import { AgeCategory, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { findCarrier } from "@/lib/carriers/registry";
import { requireAuth } from "@/lib/auth/guard";
import { computeFinalPrice, type AgeCategoryId } from "@/lib/pricing";
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


  const snapshot = body.tripSnapshot ?? {};
  if (
    !snapshot.from ||
    !snapshot.to ||
    !snapshot.departure ||
    !snapshot.arrival ||
    typeof snapshot.price !== "number"
  ) {
    return NextResponse.json(
      { error: "`tripSnapshot` must include from, to, departure, arrival, price" },
      { status: 400 }
    );
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

  // Base price comes from the trip snapshot. Age-category discount + promo
  // code are applied server-side so the client cannot undercut the fare by
  // spoofing tripSnapshot beyond the original price.
  const pricing = computeFinalPrice(
    snapshot.price,
    passenger.ageCategory as AgeCategoryId,
    body.promoCode
  );
  const basePrice = pricing.basePrice;
  const finalPrice = pricing.finalPrice;
  const appliedPromoCode = pricing.promo?.code ?? null;

  const departureAt = combineDateTime(snapshot.date, snapshot.departure);
  const arrivalAt = combineDateTime(snapshot.date, snapshot.arrival);
  if (arrivalAt <= departureAt) {
    arrivalAt.setUTCDate(arrivalAt.getUTCDate() + 1);
  }

  // Persist carrier, trip, ticket, and booking in one transaction.
  try {
    const reference = generateReference();
    const created = await prisma.$transaction(async (tx) => {
      const carrier = await tx.carrier.upsert({
        where: { name: snapshot.carrier ?? adapter.name },
        update: {},
        create: {
          name: snapshot.carrier ?? adapter.name,
          rating: snapshot.rating ?? 0,
        },
      });

      const trip = await tx.trip.create({
        data: {
          fromCity: snapshot.from!,
          toCity: snapshot.to!,
          departureTime: departureAt,
          arrivalTime: arrivalAt,
          price: basePrice,
          carrierId: carrier.id,
        },
      });

      const ticket = await tx.ticket.create({
        data: {
          userId: session.sub,
          tripId: trip.id,
          status: TicketStatus.RESERVED,
          basePrice,
          price: finalPrice,
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
            promoCode: pricing.promo?.code ?? null,
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
