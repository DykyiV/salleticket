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
const BRAND = rgb(0.075, 0.286, 0.769);
const NAVY = rgb(0.06, 0.09, 0.16);
const PAPER = rgb(0.96, 0.97, 0.98);

type Fonts = { font: PDFFont; bold: PDFFont };

function wrap(text: string, width = 42, limit = 8): string[] {
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
  return lines.slice(0, limit);
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
  page.drawRectangle({ x: 408, y: 110, width: 170, height: 676, color: PAPER });
  page.drawRectangle({ x: 0, y: 786, width: 595, height: 56, color: BRAND });
  page.drawText("Asol BUS", { x: 24, y: 816, size: 14, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Електронний квиток", { x: 24, y: 800, size: 9, font, color: rgb(1, 1, 1) });
  page.drawText("НОМЕР БРОНЮВАННЯ", { x: 390, y: 820, size: 7, font, color: rgb(0.8, 0.88, 1) });
  page.drawText(ticket.reference, { x: 390, y: 802, size: 14, font: bold, color: rgb(1, 1, 1) });

  page.drawRectangle({ x: 18, y: 730, width: 382, height: 16, color: NAVY });
  page.drawText("ДАНІ ПАСАЖИРА", { x: 24, y: 734, size: 8, font: bold, color: rgb(1, 1, 1) });
  page.drawText("ПАСАЖИР", { x: 24, y: 712, size: 7, font, color: MUTE });
  page.drawText(ticket.passenger, { x: 24, y: 696, size: 12, font: bold, color: INK });
  page.drawText("КАТЕГОРІЯ", { x: 230, y: 712, size: 7, font, color: MUTE });
  page.drawText(ticket.category, { x: 230, y: 696, size: 11, font, color: INK });
  page.drawText("ТЕЛЕФОНИ", { x: 24, y: 678, size: 7, font, color: MUTE });
  page.drawText(ticket.phones || "—", { x: 24, y: 664, size: 10, font, color: INK });
  page.drawText("EMAIL", { x: 24, y: 646, size: 7, font, color: MUTE });
  page.drawText(ticket.email || "—", { x: 24, y: 632, size: 9, font, color: INK });
  page.drawText("ВИДАНО", { x: 230, y: 646, size: 7, font, color: MUTE });
  page.drawText(ticket.issued, { x: 230, y: 632, size: 9, font, color: INK });

  page.drawRectangle({ x: 18, y: 604, width: 382, height: 16, color: NAVY });
  page.drawText(`МАРШРУТ ${ticket.routeFrom} — ${ticket.routeTo}`.slice(0, 42), {
    x: 24,
    y: 608,
    size: 8,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(`Виїзд ${ticket.depart}   ·   Прибуття ${ticket.arrive}`, {
    x: 24,
    y: 586,
    size: 9,
    font,
    color: INK,
  });

  let y = 562;
  for (let i = 0; i < ticket.segments.length && y > 120; i += 1) {
    const segment = ticket.segments[i];
    page.drawText(String(segment.order), { x: 24, y, size: 11, font: bold, color: BRAND });
    page.drawText(segment.fromCity.slice(0, 16), { x: 44, y, size: 12, font: bold, color: INK });
    page.drawText(segment.toCity.slice(0, 16), { x: 250, y, size: 12, font: bold, color: INK });
    y -= 12;
    page.drawText(segment.depart, { x: 44, y, size: 8, font, color: MUTE });
    page.drawText(segment.arrive, { x: 250, y, size: 8, font, color: MUTE });
    y -= 12;
    page.drawText(`${segment.bus} · ${segment.seat}`.slice(0, 48), { x: 44, y, size: 8, font, color: INK });
    const layover = ticket.layovers[i];
    if (layover) {
      y -= 14;
      page.drawText(`Можлива зміна автобуса · ${layover.city} · ${layover.minutes} хв`.slice(0, 62), {
        x: 44,
        y,
        size: 8,
        font,
        color: BRAND,
      });
    }
    y -= 18;
  }

  const boxY = Math.max(y - 8, 130);
  page.drawRectangle({ x: 18, y: boxY - 62, width: 382, height: 62, borderColor: NAVY, borderWidth: 1 });
  let fy = boxY - 14;
  for (const line of wrap(TICKET_BRIEF.baggage, 32, 4)) {
    page.drawText(line, { x: 26, y: fy, size: 7, font, color: INK });
    fy -= 10;
  }
  fy = boxY - 14;
  for (const line of wrap(TICKET_BRIEF.refund, 32, 4)) {
    page.drawText(line, { x: 214, y: fy, size: 7, font, color: INK });
    fy -= 10;
  }

  page.drawText("ЕЛЕКТРОННИЙ КВИТОК", { x: 422, y: 760, size: 7, font, color: MUTE });
  page.drawText(ticket.passenger.slice(0, 22), { x: 422, y: 744, size: 10, font: bold, color: INK });
  page.drawText("ЗВІДКИ", { x: 422, y: 724, size: 7, font, color: MUTE });
  page.drawText(ticket.routeFrom, { x: 422, y: 710, size: 12, font: bold, color: INK });
  page.drawText("КУДИ", { x: 422, y: 692, size: 7, font, color: MUTE });
  page.drawText(ticket.routeTo, { x: 422, y: 678, size: 12, font: bold, color: INK });
  const qrImage = await pdf.embedPng(await qrCodePngBuffer(checkUrl));
  page.drawImage(qrImage, { x: 430, y: 500, width: 126, height: 126 });
  page.drawText(ticket.reference, { x: 436, y: 484, size: 9, font: bold, color: INK });
  page.drawText("ВАРТІСТЬ", { x: 422, y: 460, size: 7, font, color: MUTE });
  page.drawText(ticket.price, { x: 422, y: 442, size: 16, font: bold, color: INK });
  const note = wrap("QR відкриває квиток. Під час перевірки водій фіксує посадку.", 28, 3);
  note.forEach((line, index) => {
    page.drawText(line, { x: 422, y: 424 - index * 10, size: 7, font, color: MUTE });
  });

  const back = pdf.addPage([595, 842]);
  back.drawRectangle({ x: 0, y: 786, width: 595, height: 56, color: BRAND });
  back.drawText("Asol BUS · зворотна сторона квитка", { x: 24, y: 816, size: 13, font: bold, color: rgb(1, 1, 1) });
  back.drawText("Правила поведінки, багаж, страхування, повернення", {
    x: 24,
    y: 800,
    size: 9,
    font,
    color: rgb(1, 1, 1),
  });
  const columns = [28, 310];
  TICKET_BACK.forEach((section, index) => {
    const x = columns[index % 2];
    let by = index < 2 ? 750 : 430;
    back.drawText(section.title.toUpperCase(), { x, y: by, size: 10, font: bold, color: BRAND });
    by -= 16;
    for (const paragraph of section.body) {
      for (const line of wrap(paragraph, 46, 4)) {
        back.drawText(line, { x, y: by, size: 8, font, color: INK });
        by -= 11;
      }
      by -= 6;
    }
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
