import { readFileSync } from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";

/**
 * PDF e-ticket generator. Renders one A5-landscape page per ticket with the
 * passenger, trip, price and a QR code of the booking reference. DejaVu Sans
 * is embedded so Ukrainian passenger names render correctly.
 */

export type TicketPdfData = {
  reference: string;
  status: string;
  passengerName: string;
  passengerPhone: string;
  passengerEmail: string | null;
  ticketType: string;
  promoCode: string | null;
  route: string;
  departure: string;
  arrival: string;
  carrier: string;
  transportType: string;
  finalPrice: number;
  bookedBy: string;
  createdAt: string;
};

const AGE_LABELS: Record<string, string> = {
  CHILD_0_4: "Дитячий 0–4",
  CHILD_5_12: "Дитячий 5–12",
  ADULT: "Дорослий",
  SENIOR_60: "Пільговий 60+",
};

export function ageLabel(ageCategory: string): string {
  return AGE_LABELS[ageCategory] ?? ageCategory;
}

const STATUS_LABELS: Record<string, string> = {
  RESERVED: "Заброньовано",
  PAID_ONLINE: "Оплачено онлайн",
  PAID_CASH: "Оплачено готівкою",
  CANCELLED: "Скасовано",
  REFUNDED: "Повернено",
};

const TRANSPORT_LABELS: Record<string, string> = {
  BUS: "Автобус",
  FLIGHT: "Літак",
  TRAIN: "Потяг",
};

// A5 landscape, points.
const PAGE_W = 595;
const PAGE_H = 420;

const BRAND = rgb(0.16, 0.36, 0.66);
const DARK = rgb(0.12, 0.16, 0.22);
const GREY = rgb(0.42, 0.47, 0.53);
const LINE = rgb(0.85, 0.87, 0.9);

let fontCache: { regular: Buffer; bold: Buffer } | null = null;

function loadFontFiles() {
  if (!fontCache) {
    const dir = path.join(process.cwd(), "lib", "tickets", "fonts");
    fontCache = {
      regular: readFileSync(path.join(dir, "DejaVuSans.ttf")),
      bold: readFileSync(path.join(dir, "DejaVuSans-Bold.ttf")),
    };
  }
  return fontCache;
}

function drawField(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  x: number,
  y: number,
  label: string,
  value: string
) {
  page.drawText(label, { x, y, size: 7, font: fonts.regular, color: GREY });
  page.drawText(value, { x, y: y - 13, size: 10.5, font: fonts.bold, color: DARK });
}

async function drawTicketPage(
  doc: PDFDocument,
  fonts: { regular: PDFFont; bold: PDFFont },
  t: TicketPdfData
) {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const M = 32; // margin

  // Header band
  page.drawRectangle({ x: 0, y: PAGE_H - 54, width: PAGE_W, height: 54, color: BRAND });
  page.drawText("ASOL BUS", { x: M, y: PAGE_H - 36, size: 18, font: fonts.bold, color: rgb(1, 1, 1) });
  page.drawText("Електронний квиток / E-ticket", {
    x: M + 130,
    y: PAGE_H - 34,
    size: 11,
    font: fonts.regular,
    color: rgb(0.88, 0.92, 0.98),
  });
  page.drawText(t.reference, {
    x: PAGE_W - M - fonts.bold.widthOfTextAtSize(t.reference, 16),
    y: PAGE_H - 36,
    size: 16,
    font: fonts.bold,
    color: rgb(1, 1, 1),
  });

  // QR code of the booking reference
  const qrPng = await QRCode.toBuffer(t.reference, {
    type: "png",
    width: 220,
    margin: 1,
    errorCorrectionLevel: "M",
  });
  const qrImage = await doc.embedPng(qrPng);
  const qrSize = 96;
  page.drawImage(qrImage, {
    x: PAGE_W - M - qrSize,
    y: PAGE_H - 54 - 24 - qrSize,
    width: qrSize,
    height: qrSize,
  });
  page.drawText("Пред'явіть при посадці", {
    x: PAGE_W - M - qrSize,
    y: PAGE_H - 54 - 34 - qrSize,
    size: 7,
    font: fonts.regular,
    color: GREY,
  });

  // Route block
  let y = PAGE_H - 92;
  page.drawText(t.route, { x: M, y, size: 20, font: fonts.bold, color: DARK });
  y -= 20;
  page.drawText(
    `${TRANSPORT_LABELS[t.transportType] ?? t.transportType} · ${t.carrier}`,
    { x: M, y, size: 10, font: fonts.regular, color: GREY }
  );

  // Divider
  y -= 14;
  page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 1, color: LINE });

  // Two-column field grid
  y -= 28;
  const col2 = M + 240;
  drawField(page, fonts, M, y, "ПАСАЖИР", t.passengerName);
  drawField(page, fonts, col2, y, "ВИЇЗД", t.departure);
  y -= 42;
  drawField(page, fonts, M, y, "ТЕЛЕФОН", t.passengerPhone);
  drawField(page, fonts, col2, y, "ПРИБУТТЯ", t.arrival);
  y -= 42;
  drawField(page, fonts, M, y, "EMAIL", t.passengerEmail ?? "—");
  drawField(
    page,
    fonts,
    col2,
    y,
    "ТИП КВИТКА",
    `${ageLabel(t.ticketType)}${t.promoCode ? ` · промо ${t.promoCode}` : ""}`
  );

  // Price / status band
  const bandY = 58;
  page.drawRectangle({ x: M, y: bandY, width: PAGE_W - 2 * M, height: 44, color: rgb(0.96, 0.97, 0.98) });
  page.drawText("ВАРТІСТЬ", { x: M + 14, y: bandY + 28, size: 7, font: fonts.regular, color: GREY });
  page.drawText(`€${t.finalPrice.toFixed(2)}`, {
    x: M + 14,
    y: bandY + 12,
    size: 14,
    font: fonts.bold,
    color: DARK,
  });
  page.drawText("СТАТУС", { x: M + 120, y: bandY + 28, size: 7, font: fonts.regular, color: GREY });
  page.drawText(STATUS_LABELS[t.status] ?? t.status, {
    x: M + 120,
    y: bandY + 13,
    size: 10.5,
    font: fonts.bold,
    color: DARK,
  });
  page.drawText("ОФОРМИВ", { x: M + 320, y: bandY + 28, size: 7, font: fonts.regular, color: GREY });
  page.drawText(t.bookedBy, {
    x: M + 320,
    y: bandY + 13,
    size: 10.5,
    font: fonts.bold,
    color: DARK,
  });

  // Footer
  page.drawText(
    `Видано ${t.createdAt} · asol-bus · Цей квиток є підтвердженням бронювання.`,
    { x: M, y: 30, size: 7.5, font: fonts.regular, color: GREY }
  );
}

const fmtDt = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ");

/** Shape of the Prisma ticket graph the mapper expects. */
export type TicketWithDetails = {
  id: string;
  status: string;
  finalPrice: number;
  createdAt: Date;
  booking: {
    reference: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    ageCategory: string;
    promoCode: string | null;
  } | null;
  user: { email: string };
  trip: {
    fromCity: string;
    toCity: string;
    departureTime: Date;
    arrivalTime: Date;
    transportType: string;
    carrier: { name: string };
  } | null;
};

/** Map a Prisma ticket (with booking, user, trip.carrier) to PDF data. */
export function toTicketPdfData(t: TicketWithDetails): TicketPdfData {
  return {
    reference: t.booking?.reference ?? t.id.slice(-8).toUpperCase(),
    status: t.status,
    passengerName: t.booking
      ? `${t.booking.firstName} ${t.booking.lastName}`
      : "—",
    passengerPhone: t.booking?.phone ?? "—",
    passengerEmail: t.booking?.email ?? null,
    ticketType: t.booking?.ageCategory ?? "ADULT",
    promoCode: t.booking?.promoCode ?? null,
    route: t.trip ? `${t.trip.fromCity} → ${t.trip.toCity}` : "—",
    departure: t.trip ? fmtDt(t.trip.departureTime) : "—",
    arrival: t.trip ? fmtDt(t.trip.arrivalTime) : "—",
    carrier: t.trip?.carrier.name ?? "—",
    transportType: t.trip?.transportType ?? "BUS",
    finalPrice: t.finalPrice,
    bookedBy: t.user.email,
    createdAt: fmtDt(t.createdAt),
  };
}

/**
 * Build a single PDF containing one page per ticket, in the given order.
 */
export async function buildTicketsPdf(
  tickets: TicketPdfData[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle("Asol BUS — квитки");
  doc.setProducer("asol-bus");
  const files = loadFontFiles();
  const fonts = {
    regular: await doc.embedFont(files.regular),
    bold: await doc.embedFont(files.bold),
  };
  for (const t of tickets) {
    await drawTicketPage(doc, fonts, t);
  }
  return doc.save();
}
