import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isValidSeatNumber } from "@/lib/seats";
import { getSiteSettings } from "@/lib/settings";
import {
  SeatHeldError,
  SeatRequiredError,
  SeatTakenError,
  assertSeatAvailable,
  tripAssignsSeats,
} from "@/lib/tickets/inventory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

type HoldBody = {
  seatNumber?: number;
  sessionId?: string;
  fromStopIndex?: number | null;
  toStopIndex?: number | null;
};

function readBody(req: NextRequest): Promise<HoldBody> {
  return req.json().catch(() => ({}));
}

/**
 * Lock a seat for the booking session so nobody else can take it while the
 * passenger finishes the form. Holds expire after `seatHoldMinutes`.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const body = await readBody(req);
  const sessionId = body.sessionId?.trim();
  const seatNumber = body.seatNumber;
  if (!sessionId || sessionId.length < 8) {
    return NextResponse.json({ error: "Немає сесії" }, { status: 400 });
  }
  if (seatNumber == null || !isValidSeatNumber(seatNumber)) {
    return NextResponse.json({ error: "Некоректне місце" }, { status: 400 });
  }

  const trip = await prisma.trip.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!trip) {
    return NextResponse.json({ error: "Рейс не знайдено" }, { status: 404 });
  }
  if (!(await tripAssignsSeats(prisma, trip.id))) {
    return NextResponse.json(
      { error: "На цьому виїзді місця не призначаються" },
      { status: 400 }
    );
  }

  const settings = await getSiteSettings();
  const expiresAt = new Date(Date.now() + settings.seatHoldMinutes * 60_000);
  const segment =
    Number.isInteger(body.fromStopIndex) &&
    Number.isInteger(body.toStopIndex) &&
    (body.toStopIndex as number) > (body.fromStopIndex as number)
      ? { fromIndex: body.fromStopIndex as number, toIndex: body.toStopIndex as number }
      : undefined;

  try {
    const hold = await prisma.$transaction(async (tx) => {
      await tx.seatHold.deleteMany({
        where: { tripId: trip.id, expiresAt: { lte: new Date() } },
      });
      await assertSeatAvailable(tx, trip.id, seatNumber, undefined, sessionId, segment);

      const existing = await tx.seatHold.findUnique({
        where: { tripId_seatNumber: { tripId: trip.id, seatNumber } },
      });
      if (existing && existing.sessionId !== sessionId) {
        throw new SeatHeldError(seatNumber);
      }
      if (existing) {
        return tx.seatHold.update({
          where: { id: existing.id },
          data: {
            expiresAt,
            fromStopIndex: segment?.fromIndex ?? null,
            toStopIndex: segment?.toIndex ?? null,
          },
        });
      }
      return tx.seatHold.create({
        data: {
          tripId: trip.id,
          seatNumber,
          sessionId,
          expiresAt,
          fromStopIndex: segment?.fromIndex ?? null,
          toStopIndex: segment?.toIndex ?? null,
        },
      });
    });
    return NextResponse.json({ hold }, { status: 201 });
  } catch (err) {
    if (
      err instanceof SeatTakenError ||
      err instanceof SeatHeldError ||
      err instanceof SeatRequiredError
    ) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Не вдалося забронювати місце" },
      { status: 500 }
    );
  }
}

/** Release a session hold (passenger deselected the seat). */
export async function DELETE(req: NextRequest, { params }: Params) {
  const body = await readBody(req);
  const sessionId = body.sessionId?.trim();
  const seatNumber = body.seatNumber;
  if (!sessionId) {
    return NextResponse.json({ error: "Немає сесії" }, { status: 400 });
  }
  await prisma.seatHold.deleteMany({
    where: {
      tripId: params.id,
      sessionId,
      ...(seatNumber != null ? { seatNumber } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}
