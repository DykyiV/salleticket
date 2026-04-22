import { NextResponse, type NextRequest } from "next/server";
import { AgeCategory, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { findCarrier } from "@/lib/carriers/registry";
import { requireAuth } from "@/lib/auth/guard";
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

function resolvePassenger(
  p?: PassengerPayload
): { ok: true; passenger: ResolvedPassenger } | { ok: false; error: string } {
  if (!p) return { ok: false, error: "`passenger` is required" };

  let firstName = p.firstName?.trim() ?? "";
  let lastName = p.lastName?.trim() ?? "";
  if ((!firstName || !lastName) && p.name) {
    const split = splitName(p.name);
    firstName = firstName || split.firstName;
    lastName = lastName || split.lastName;
  }

  if (firstName.length < 1) {
    return { ok: false, error: "`passenger.firstName` is required" };
  }
  if (lastName.length < 1) {
    return { ok: false, error: "`passenger.lastName` is required" };
  }

  const digits = (p.phone ?? "").replace(/\D/g, "");
  if (digits.length < 7) {
    return {
      ok: false,
      error: "`passenger.phone` must contain at least 7 digits",
    };
  }
  if (p.email && !/^\S+@\S+\.\S+$/.test(p.email)) {
    return {
      ok: false,
      error: "`passenger.email` is not a valid email address",
    };
  }

  let ageCategory: AgeCategory = AgeCategory.ADULT;
  if (p.ageCategory) {
    if (!(p.ageCategory in AgeCategory)) {
      return {
        ok: false,
        error:
          "`passenger.ageCategory` must be one of CHILD_0_4, CHILD_5_12, ADULT, SENIOR_60",
      };
    }
    ageCategory = p.ageCategory as AgeCategory;
  }

  return {
    ok: true,
    passenger: {
      firstName,
      lastName,
      ageCategory,
      phone: (p.phone ?? "").trim(),
      email: p.email?.trim() || undefined,
    },
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

  const resolved = resolvePassenger(body.passenger);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }
  const passenger = resolved.passenger;

  // Snapshot shape for downstream carrier adapter (still expects { name, ... }).
  const adapterPassenger: BookingPassenger = {
    name: `${passenger.firstName} ${passenger.lastName}`.trim(),
    phone: passenger.phone,
    email: passenger.email,
  };

  const promoCode = body.promoCode?.trim() || undefined;

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

  const basePrice = Math.round(snapshot.price * 100) / 100;
  // Final price will be recomputed once age-category discounts and promo-code
  // validation land; for now it mirrors the base price.
  const finalPrice = basePrice;

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
          email: passenger.email ?? null,
          promoCode: promoCode ?? null,
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
