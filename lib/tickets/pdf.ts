import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Prisma } from "@prisma/client";
import { qrCodePngBuffer } from "@/lib/tickets/qrcode";
import { TICKET_BACK, TICKET_BRIEF } from "@/lib/legal";
import { buildETicket } from "@/lib/tickets/eTicket";

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
      trip: {
        include: {
          carrier: true,
          departure: {
            include: {
              stops: true,
              bus: true,
              template: true,
            },
          },
        },
      },
      returnTrip: true,
      legs: { include: { assignment: { include: { bus: true, leg: true } } } },
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

function wrap(text: string, width = 42): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

async function drawTicketPage(
  pdf: PDFDocument,
  booking: TicketPdfBooking,
  fonts: Fonts,
  checkUrl: string
): Promise<void> {
  const { font, bold } = fonts;
  const ticket = buildETicket(booking);
  const page = pdf.addPage([595, 842]);
  page.drawRectangle({ x: 0, y: 790, width: 595, height: 52, color: BRAND });
  page.drawText("Asol BUS", { x: 28, y: 812, size: 14, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Електронний квиток", { x: 28, y: 798, size: 9, font, color: rgb(1, 1, 1) });
  page.drawText(ticket.reference, { x: 400, y: 808, size: 14, font: bold, color: rgb(1, 1, 1) });

  let y = 760;
  page.drawText("Дані пасажира", { x: 28, y, size: 9, font: bold, color: BRAND });
  y -= 16;
  page.drawText(ticket.passenger, { x: 28, y, size: 12, font: bold, color: INK });
  y -= 14;
  page.drawText(`${ticket.category} · ${ticket.phones}`, { x: 28, y, size: 9, font, color: MUTE });
  y -= 12;
  page.drawText(ticket.email, { x: 28, y, size: 9, font, color: MUTE });
  y -= 24;
  page.drawText(`Маршрут ${ticket.routeFrom} — ${ticket.routeTo}`, { x: 28, y, size: 12, font: bold, color: INK });
  y -= 14;
  page.drawText(`Виїзд ${ticket.depart}    Прибуття ${ticket.arrive}`, { x: 28, y, size: 9, font, color: MUTE });

  for (let i = 0; i < ticket.segments.length; i += 1) {
    const segment = ticket.segments[i];
    y -= 22;
    page.drawText(`${segment.order}. ${segment.fromCity} → ${segment.toCity}`, { x: 28, y, size: 11, font: bold, color: INK });
    y -= 13;
    page.drawText(`${segment.depart}  →  ${segment.arrive}`, { x: 28, y, size: 9, font, color: INK });
    y -= 12;
    page.drawText(`${segment.bus} · ${segment.seat}`, { x: 28, y, size: 9, font, color: MUTE });
    const layover = ticket.layovers[i];
    if (layover) {
      y -= 16;
      page.drawText(`Можлива зміна автобуса · ${layover.city} · ${layover.minutes} хв`, {
        x: 28,
        y,
        size: 9,
        font,
        color: BRAND,
      });
    }
  }

  y -= 28;
  for (const line of wrap(TICKET_BRIEF.baggage, 90)) {
    page.drawText(line, { x: 28, y, size: 8, font, color: INK });
    y -= 11;
  }
  y -= 4;
  for (const line of wrap(TICKET_BRIEF.refund, 90)) {
    page.drawText(line, { x: 28, y, size: 8, font, color: INK });
    y -= 11;
  }
  page.drawText(`Вартість ${ticket.price}`, { x: 28, y: 48, size: 12, font: bold, color: INK });

  const qrImage = await pdf.embedPng(await qrCodePngBuffer(checkUrl));
  page.drawImage(qrImage, { x: 450, y: 680, width: 110, height: 110 });
  page.drawText("QR для посадки", { x: 468, y: 666, size: 8, font, color: MUTE });

  const back = pdf.addPage([595, 842]);
  back.drawRectangle({ x: 0, y: 790, width: 595, height: 52, color: BRAND });
  back.drawText("Зворотна сторона квитка", { x: 28, y: 808, size: 14, font: bold, color: rgb(1, 1, 1) });
  let by = 760;
  for (const section of TICKET_BACK) {
    back.drawText(section.title, { x: 28, y: by, size: 11, font: bold, color: BRAND });
    by -= 16;
    for (const paragraph of section.body) {
      for (const line of wrap(paragraph, 95)) {
        back.drawText(line, { x: 28, y: by, size: 9, font, color: INK });
        by -= 12;
      }
      by -= 4;
    }
    by -= 8;
  }
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
