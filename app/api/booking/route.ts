import { NextResponse, type NextRequest } from "next/server";
import { findCarrier } from "@/lib/carriers/registry";
import {
  bookingStore,
  generateReference,
} from "@/lib/bookings/store";
import type { BookingPassenger, Trip } from "@/lib/carriers/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CreateBookingBody = {
  tripId?: string;
  carrierId?: string;
  passenger?: Partial<BookingPassenger>;
  tripSnapshot?: Partial<Trip>;
};

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

const SERVICE_FEE_EUR = 1.5;

export async function POST(req: NextRequest) {
  let body: CreateBookingBody;
  try {
    body = (await req.json()) as CreateBookingBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const carrierId = body.carrierId ?? "mock";
  const carrier = findCarrier(carrierId);
  if (!carrier) {
    return NextResponse.json(
      { error: `Unknown carrier: ${carrierId}` },
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

  let carrierResult;
  try {
    carrierResult = await carrier.book({
      tripId: body.tripId,
      carrierId,
      passenger,
      tripSnapshot: body.tripSnapshot,
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

  const reference = generateReference();
  const price = carrierResult.confirmedTrip.price ?? body.tripSnapshot?.price ?? 0;
  const record = bookingStore.create({
    reference,
    status: carrierResult.status,
    createdAt: new Date().toISOString(),
    carrierId: carrier.id,
    carrierName: carrier.name,
    tripId: body.tripId,
    passenger,
    trip: carrierResult.confirmedTrip,
    totalPaid: Math.round((price + SERVICE_FEE_EUR) * 100) / 100,
  });

  return NextResponse.json(
    {
      booking: record,
      carrierReference: carrierResult.carrierReference,
      fees: { service: SERVICE_FEE_EUR, currency: "EUR" },
    },
    { status: 201 }
  );
}

export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get("reference");
  if (!reference) {
    return NextResponse.json(
      { bookings: bookingStore.list() },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const booking = bookingStore.find(reference);
  if (!booking) {
    return NextResponse.json(
      { error: "Booking not found" },
      { status: 404 }
    );
  }
  return NextResponse.json({ booking });
}
