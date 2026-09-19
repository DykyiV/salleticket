import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildLayout, parseCoachLayout } from "@/lib/seats";
import { recordTicketHistory } from "@/lib/tickets/history";
import { notifyScheduleChanged } from "@/lib/notify";
import { soldOnAssignment } from "@/lib/ops/legs";
import { FULL_ROUTE } from "@/lib/trips/segments";

type Db = PrismaClient | Prisma.TransactionClient;

export class SwapCapacityError extends Error {
  constructor(booked: number, capacity: number) {
    super(
      `Заміна неможлива: заброньовано ${booked} пасажирів, а в новому автобусі лише ${capacity} місць`
    );
    this.name = "SwapCapacityError";
  }
}

export type SwapResult = {
  kept: number;
  remapped: { reference: string; from: number; to: number }[];
  bookedCount: number;
  newCapacity: number;
};

/**
 * Quick bus swap on an assignment. Allowed when the new bus capacity covers
 * the actually booked passengers (not the old bus capacity). Seats that
 * exist in the new layout are kept; missing ones are auto-reassigned.
 * Bookings stay valid — no ticket is cancelled or recreated.
 */
export async function swapAssignmentBus(options: {
  assignmentId: string;
  newBusId: string;
  changedBy: string | null;
  db?: Db;
}): Promise<SwapResult> {
  const db = options.db ?? prisma;

  const assignment = await db.vehicleAssignment.findUnique({
    where: { id: options.assignmentId },
    include: { bus: true, leg: { include: { departure: { include: { template: true } } } } },
  });
  if (!assignment) throw new Error("Призначення не знайдено");
  const newBus = await db.bus.findUnique({ where: { id: options.newBusId } });
  if (!newBus) throw new Error("Автобус не знайдено");

  const newLayout = buildLayout(parseCoachLayout(newBus.layout));
  const newCapacity = newLayout.seatCount;
  const newSeatNumbers = new Set(newLayout.seats.map((s) => s.number));

  const ticketLegs = await db.ticketLeg.findMany({
    where: {
      assignmentId: assignment.id,
      ticket: { status: { in: ["RESERVED", "AWAITING_PAYMENT", "PAID_ONLINE", "PAID_CASH"] } },
    },
    include: { ticket: { include: { booking: true } } },
  });
  const bookedCount = ticketLegs.length;
  if (bookedCount > newCapacity) {
    throw new SwapCapacityError(bookedCount, newCapacity);
  }

  const taken = await soldOnAssignment(db, assignment.id, FULL_ROUTE);
  const freeSeats = newLayout.seats
    .map((s) => s.number)
    .filter((n) => !taken.has(n));

  const remapped: SwapResult["remapped"] = [];
  let kept = 0;
  const used = new Set<number>();

  for (const leg of ticketLegs) {
    const seat = leg.seatNumber;
    if (seat != null && newSeatNumbers.has(seat) && !used.has(seat)) {
      used.add(seat);
      kept += 1;
      continue;
    }
    const nextSeat = freeSeats.find((n) => !used.has(n)) ?? null;
    if (nextSeat == null) {
      throw new SwapCapacityError(bookedCount, newCapacity);
    }
    used.add(nextSeat);
    await db.ticketLeg.update({
      where: { id: leg.id },
      data: { seatNumber: nextSeat },
    });
    // Keep the denormalized primary seat in sync for leg-1 rows.
    if (leg.order === 1) {
      await db.ticket.update({
        where: { id: leg.ticketId },
        data: { seatNumber: nextSeat },
      });
    }
    await recordTicketHistory(db, {
      ticketId: leg.ticketId,
      action: "SEAT_CHANGED",
      source: "SYSTEM",
      changedBy: options.changedBy,
      changes: { seatNumber: { from: seat, to: nextSeat } },
    });
    remapped.push({
      reference: leg.ticket.booking?.reference ?? leg.ticketId,
      from: seat ?? 0,
      to: nextSeat,
    });
  }

  await db.vehicleAssignment.update({
    where: { id: assignment.id },
    data: { busId: newBus.id },
  });
  await db.ticket.updateMany({
    where: { assignmentId: assignment.id },
    data: { assignmentId: assignment.id },
  });

  const departure = assignment.leg.departure;
  await notifyScheduleChanged(
    `${departure.template.name} · ${departure.date.toISOString().slice(0, 10)} — автобус замінено на ${newBus.model ?? "Автобус"} ${newBus.plate}`
  );

  return { kept, remapped, bookedCount, newCapacity };
}
