import { NextResponse, type NextRequest } from "next/server";
import { TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { findCarrier } from "@/lib/carriers/registry";
import { requireAuth } from "@/lib/auth/guard";
import type { BookingPassenger, Trip } from "@/lib/carriers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateBookingBody = {
  tripId?: string;
  carrierId?: string;
  passenger?: Partial<BookingPassenger>;
  tripSnapshot?: Partial<Trip> & { date?: string };
};

const SERVICE_FEE_EUR = 1.5;

function validatePassenger(p?: Partial<BookingPassenger>): string | null {
  if (!p) return "`passenger` is required";
  if (!p.name || p.name.trim().length < 2) {
    return "`passenger.name` must be at least 2 characters";
  }
  const digits = (p.phone ?? "").replace(/\D/g, "");
  if (digits.length < 7) {
    return "`passenger.phone` must contain at least 7 digits";
  }
  if (p.email && !/^\S+@\S+\.\S+$/.test(p.email)) {
    return "`passenger.email` is not a valid email address";
  }
  return null;
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

  const passengerError = validatePassenger(body.passenger);
  if (passengerError) {
    return NextResponse.json({ error: passengerError }, { status: 400 });
  }

  const passenger: BookingPassenger = {
    name: body.passenger!.name!.trim(),
    phone: body.passenger!.phone!.trim(),
    email: body.passenger!.email?.trim() || undefined,
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
      passenger,
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

  const price = Math.round(snapshot.price * 100) / 100;
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
          price,
          carrierId: carrier.id,
        },
      });

      const ticket = await tx.ticket.create({
        data: {
          userId: session.sub,
          tripId: trip.id,
          status: TicketStatus.RESERVED,
          price,
        },
      });

      const booking = await tx.booking.create({
        data: {
          reference,
          passengerName: passenger.name,
          phone: passenger.phone,
          email: passenger.email ?? null,
          ticketId: ticket.id,
        },
      });

      return { carrier, trip, ticket, booking };
    });

    const totalPaid = price + SERVICE_FEE_EUR;

    return NextResponse.json(
      {
        booking: {
          id: created.booking.id,
          reference: created.booking.reference,
          status: created.ticket.status,
          createdAt: created.booking.createdAt,
          passenger: {
            name: created.booking.passengerName,
            phone: created.booking.phone,
            email: created.booking.email ?? undefined,
          },
          trip: {
            from: created.trip.fromCity,
            to: created.trip.toCity,
            departure: snapshot.departure,
            arrival: snapshot.arrival,
            departureAt: created.trip.departureTime,
            arrivalAt: created.trip.arrivalTime,
            price: created.trip.price,
            currency: snapshot.currency ?? "EUR",
          },
          carrier: {
            id: created.carrier.id,
            name: created.carrier.name,
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
