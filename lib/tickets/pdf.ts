import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Prisma } from "@prisma/client";
import { qrCodePngBuffer } from "@/lib/tickets/qrcode";
import { toBoardingPass } from "@/lib/tickets/boardingPass";

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
      legs: { include: { assignment: { include: { bus: true } } } },
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
  { font, bold }: Fonts,
  checkUrl: string
): Promise<void> {
  const page = pdf.addPage([420, 560]);
  const pass = toBoardingPass(booking);
  let y = 528;

  page.drawText("Asol BUS — посадковий талон", { x: 24, y, size: 10, font, color: MUTE });
  y -= 28;
  page.drawText(pass.reference, { x: 24, y, size: 22, font: bold, color: INK });
  y -= 22;
  page.drawText(pass.passengerName, { x: 24, y, size: 13, font: bold, color: INK });
  y -= 16;
  page.drawText(pass.phones.join(" · ") || "—", { x: 24, y, size: 9, font, color: MUTE });
  y -= 22;
  page.drawText(`${pass.fromCity} → ${pass.toCity}`, { x: 24, y, size: 12, font, color: INK });
  y -= 18;
  page.drawText(`Виїзд: ${pass.departureLabel}`, { x: 24, y, size: 10, font, color: INK });
  y -= 14;
  page.drawText(`Прибуття: ${pass.arrivalLabel}`, { x: 24, y, size: 10, font, color: INK });
  y -= 20;
  page.drawText("Місце посадки", { x: 24, y, size: 8, font, color: MUTE });
  y -= 14;
  for (const line of wrap(pass.boardingPlace)) {
    page.drawText(line, { x: 24, y, size: 10, font, color: INK });
    y -= 13;
  }
  if (pass.coordinates) {
    page.drawText(pass.coordinates, { x: 24, y, size: 9, font, color: BRAND });
    y -= 14;
  }
  y -= 6;
  page.drawText(`Автобус: ${pass.busNumber}`, { x: 24, y, size: 11, font: bold, color: INK });
  y -= 16;
  page.drawText(`Тел. автобуса: ${pass.busPhone}`, { x: 24, y, size: 10, font, color: INK });
  y -= 14;
  page.drawText(`Диспетчер: ${pass.dispatcherPhone}`, { x: 24, y, size: 10, font, color: INK });
  y -= 16;
  page.drawText(`Місце в салоні: ${pass.seatLabel}`, { x: 24, y, size: 10, font, color: INK });

  const qrImage = await pdf.embedPng(await qrCodePngBuffer(checkUrl));
  page.drawImage(qrImage, { x: 300, y: 430, width: 96, height: 96 });
  page.drawText("QR для посадки", { x: 308, y: 416, size: 8, font, color: MUTE });
  page.drawText("Покажіть цей талон і QR водієві при посадці.", {
    x: 24,
    y: 24,
    size: 8,
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
