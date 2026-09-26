import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Prisma } from "@prisma/client";
import { qrCodePngBuffer } from "@/lib/tickets/qrcode";
import { formatUkDate } from "@/lib/routes/dates";
import {
  AGE_LABEL,
  TICKET_STATUS_LABEL,
  TRIP_KIND_LABEL,
} from "@/lib/tickets/labels";

/**
 * Ticket PDF rendering shared by the single-ticket download
 * (GET /api/tickets/[reference]/pdf) and the staff bulk print
 * (GET /api/tickets/bulk-pdf?ids=…), so both produce identical pages:
 * booking number, status, route, seat, passenger, price and a boarding QR
 * that opens /check/<reference>.
 */

/** Prisma include that loads everything a ticket page needs. */
export const TICKET_PDF_INCLUDE = {
  ticket: {
    include: {
      trip: { include: { carrier: true } },
      returnTrip: true,
    },
  },
} satisfies Prisma.BookingInclude;

export type TicketPdfBooking = Prisma.BookingGetPayload<{
  include: typeof TICKET_PDF_INCLUDE;
}>;

const INK = rgb(0.12, 0.16, 0.23);
const MUTE = rgb(0.42, 0.46, 0.52);
const BRAND = rgb(0.02, 0.44, 0.67);

type Fonts = { font: PDFFont; bold: PDFFont };

async function drawTicketPage(
  pdf: PDFDocument,
  booking: TicketPdfBooking,
  { font, bold }: Fonts,
  checkUrl: string
): Promise<void> {
  const page = pdf.addPage([420, 300]);
  const { ticket } = booking;

  page.drawText("Asol BUS — квиток", { x: 24, y: 268, size: 10, font, color: MUTE });
  page.drawText(booking.reference, { x: 24, y: 240, size: 22, font: bold, color: INK });
  page.drawText(TICKET_STATUS_LABEL[ticket.status] ?? ticket.status, {
    x: 24,
    y: 224,
    size: 9,
    font,
    color: BRAND,
  });

  const trip = ticket.trip;
  if (trip) {
    page.drawText(`${trip.fromCity} → ${trip.toCity}`, {
      x: 24,
      y: 198,
      size: 13,
      font,
      color: INK,
    });
    page.drawText(
      `${formatUkDate(trip.departureTime)} · ${trip.departureTime.toISOString().slice(11, 16)} · ${trip.carrier.name}`,
      { x: 24, y: 182, size: 9, font, color: MUTE }
    );
  }

  const kindLine =
    ticket.tripKind !== "ONE_WAY" ? TRIP_KIND_LABEL[ticket.tripKind] ?? "" : "";
  page.drawText(
    `Місце: ${ticket.seatNumber != null ? ticket.seatNumber : "без місць"}${kindLine ? ` · ${kindLine}` : ""}`,
    { x: 24, y: 164, size: 10, font, color: INK }
  );
  if (ticket.returnTrip) {
    page.drawText(
      `Назад: ${ticket.returnTrip.fromCity} → ${ticket.returnTrip.toCity} · ${formatUkDate(ticket.returnTrip.departureTime)}${ticket.returnSeatNumber != null ? ` · місце ${ticket.returnSeatNumber}` : ""}`,
      { x: 24, y: 150, size: 9, font, color: MUTE }
    );
  }

  page.drawText(`${booking.firstName} ${booking.lastName}`, {
    x: 24,
    y: 126,
    size: 11,
    font,
    color: INK,
  });
  page.drawText(
    `${AGE_LABEL[booking.ageCategory] ?? booking.ageCategory} · ${booking.phone}`,
    { x: 24, y: 112, size: 9, font, color: MUTE }
  );
  page.drawText(`До сплати: €${booking.finalPrice.toFixed(2)}`, {
    x: 24,
    y: 94,
    size: 11,
    font: bold,
    color: INK,
  });

  const qrImage = await pdf.embedPng(await qrCodePngBuffer(checkUrl));
  page.drawImage(qrImage, { x: 296, y: 156, width: 100, height: 100 });
  page.drawText("QR для посадки", { x: 306, y: 144, size: 8, font, color: MUTE });

  page.drawText("Демо — реальна оплата не проводиться.", {
    x: 24,
    y: 24,
    size: 7,
    font,
    color: MUTE,
  });
}

/**
 * One PDF with one page per booking, in the given order.
 * `origin` is the site origin (e.g. "https://asolbus.com") used for the QR.
 */
export async function buildTicketsPdf(
  bookings: TicketPdfBooking[],
  origin: string
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontsDir = path.join(process.cwd(), "assets", "fonts");
  const [fontBytes, boldBytes] = await Promise.all([
    readFile(path.join(fontsDir, "DejaVuSans.ttf")),
    readFile(path.join(fontsDir, "DejaVuSans-Bold.ttf")),
  ]);
  const fonts: Fonts = {
    font: await pdf.embedFont(fontBytes),
    bold: await pdf.embedFont(boldBytes),
  };

  for (const booking of bookings) {
    await drawTicketPage(pdf, booking, fonts, `${origin}/check/${booking.reference}`);
  }
  return pdf.save();
}
