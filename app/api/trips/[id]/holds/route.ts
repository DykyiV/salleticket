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
  tripIdsOnSameCoach,
} from "@/lib/tickets/inventory";
import { clientIp, limitKey } from "@/lib/security/rateLimit";
import { readVisitorId, setVisitorCookie, visitorId } from "@/lib/security/visitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Seats one visitor may hold on a coach at a time (= max passengers). */
export const MAX_HOLDS_PER_VISITOR = 6;
/** Seats one network (IP) may hold on a coach at a time. */
export const MAX_HOLDS_PER_IP = 10;
/** Upper bound for a hold, whatever the site setting says. */
const MAX_HOLD_MINUTES = 10;

class HoldLimitError extends Error {}

type HoldBody = {
  seatNumber?: number;
  /** Ignored: the hold belongs to the server-issued visitor cookie. */
  sessionId?: string;
  fromStopIndex?: number | null;
  toStopIndex?: number | null;
};

function readBody(req: NextRequest): Promise<HoldBody> {
  return req.json().catch(() => ({}));
}

/**
 * Lock a seat for the visitor so nobody else can take it while the passenger
 * finishes the form. Holds expire after `seatHoldMinutes` (at most 10 min);
 * one visitor holds at most 6 seats and one network at most 10 seats per
 * coach.
 */
export async function POST(req: NextRequest, props: Params) {
  const params = await props.params;
  const body = await readBody(req);
  const visitor = visitorId(req);
  const sessionId = visitor.id;
  const ip = clientIp(req);
  const ipHash = ip ? limitKey("hold:ip", ip) : null;
  const seatNumber = body.seatNumber;
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
  const holdMinutes = Math.min(settings.seatHoldMinutes, MAX_HOLD_MINUTES);
  const expiresAt = new Date(Date.now() + holdMinutes * 60_000);
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
      if (!existing) {
        const coach = await tripIdsOnSameCoach(tx, trip.id);
        const active = { tripId: { in: coach }, expiresAt: { gt: new Date() } };
        const [mine, network] = await Promise.all([
          tx.seatHold.count({ where: { ...active, sessionId } }),
          ipHash ? tx.seatHold.count({ where: { ...active, ipHash } }) : Promise.resolve(0),
        ]);
        if (mine >= MAX_HOLDS_PER_VISITOR) {
          throw new HoldLimitError(
            `Можна тримати не більше ${MAX_HOLDS_PER_VISITOR} місць одночасно. Звільніть зайве місце або завершіть бронювання.`
          );
        }
        if (network >= MAX_HOLDS_PER_IP) {
          throw new HoldLimitError(
            "З вашої мережі зараз утримується забагато місць. Спробуйте за кілька хвилин."
          );
        }
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
          ipHash,
          expiresAt,
          fromStopIndex: segment?.fromIndex ?? null,
          toStopIndex: segment?.toIndex ?? null,
        },
      });
    });
    const res = NextResponse.json(
      { hold: { seatNumber: hold.seatNumber, expiresAt: hold.expiresAt } },
      { status: 201 }
    );
    if (visitor.isNew) setVisitorCookie(res, sessionId);
    return res;
  } catch (err) {
    if (err instanceof HoldLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
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
export async function DELETE(req: NextRequest, props: Params) {
  const params = await props.params;
  const body = await readBody(req);
  const sessionId = readVisitorId(req);
  const seatNumber = body.seatNumber;
  if (!sessionId) return NextResponse.json({ ok: true });
  await prisma.seatHold.deleteMany({
    where: {
      tripId: params.id,
      sessionId,
      ...(seatNumber != null ? { seatNumber } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}
