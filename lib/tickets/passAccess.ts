import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { getSessionFromRequest } from "@/lib/auth/session";
import { readGuestToken } from "@/lib/auth/guest";
import { TICKET_PDF_INCLUDE, type TicketPdfBooking } from "@/lib/tickets/pdf";

export class PassAccessError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "PassAccessError";
  }
}

/** Bookings the current browser may download: the owner, staff, or the guest who reserved them. */
export async function loadReadableBookings(
  req: NextRequest,
  references: string[]
): Promise<TicketPdfBooking[]> {
  const unique = [...new Set(references.map((ref) => ref.trim()).filter(Boolean))];
  if (unique.length === 0) throw new PassAccessError("Вкажіть номер талона", 400);
  const bookings = await prisma.booking.findMany({
    where: { reference: { in: unique } },
    include: TICKET_PDF_INCLUDE,
  });
  if (bookings.length !== unique.length) {
    throw new PassAccessError("Посадковий талон не знайдено", 404);
  }
  const session = await getSessionFromRequest(req);
  const guest = readGuestToken(req);
  const staff = session ? hasRoleAtLeast(session.role, "AGENT") : false;
  for (const booking of bookings) {
    const owner = session?.sub === booking.ticket.userId;
    const guestOwns = Boolean(guest && booking.ticket.guestClaim && booking.ticket.guestClaim === guest);
    if (!owner && !staff && !guestOwns) {
      throw new PassAccessError("Немає доступу до посадкового талона", 403);
    }
  }
  return bookings;
}
