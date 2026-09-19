import { prisma } from "@/lib/db";

/**
 * Migrate existing departures to the operational model without touching
 * bookings: every departure gets a default leg ("Основне плече"), its trips
 * link to it, and the departure's bus becomes the first VehicleAssignment.
 * Existing tickets get a TicketLeg mirroring their current trip/seat and
 * point at that assignment, so old bookings stay valid.
 */
export async function migrateToOperationalModel(): Promise<{
  legs: number;
  assignments: number;
  ticketLegs: number;
}> {
  let legs = 0;
  let assignments = 0;
  let ticketLegs = 0;

  const departures = await prisma.departure.findMany({
    include: { trips: true, legs: { include: { assignments: true } } },
  });

  for (const departure of departures) {
    let leg = departure.legs[0];
    if (!leg) {
      const created = await prisma.leg.create({
        data: {
          departureId: departure.id,
          order: 1,
          label: "Основне плече",
        },
        include: { assignments: true },
      });
      legs += 1;
      leg = created;
    }
    for (const trip of departure.trips) {
      if (!trip.legId) {
        await prisma.trip.update({
          where: { id: trip.id },
          data: { legId: leg.id },
        });
      }
    }

    let assignment = leg.assignments[0];
    if (!assignment && departure.busId) {
      assignment = await prisma.vehicleAssignment.create({
        data: { legId: leg.id, busId: departure.busId },
      });
      assignments += 1;
    }

    if (assignment) {
      const tickets = await prisma.ticket.findMany({
        where: {
          tripId: { in: departure.trips.map((t) => t.id) },
          assignmentId: null,
        },
      });
      for (const ticket of tickets) {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { assignmentId: assignment.id },
        });
        await prisma.ticketLeg.create({
          data: {
            ticketId: ticket.id,
            order: 1,
            tripId: ticket.tripId!,
            assignmentId: assignment.id,
            seatNumber: ticket.seatNumber,
            fromStopIndex: ticket.fromStopIndex,
            toStopIndex: ticket.toStopIndex,
          },
        });
        ticketLegs += 1;
      }
    }
  }

  return { legs, assignments, ticketLegs };
}
