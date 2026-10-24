import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Lang } from "@/lib/i18n/config";
import { dictionaries, type Dict } from "@/lib/i18n/dict";
import { fmt, localeOf, longDate, money } from "@/lib/i18n/format";
import { cityLabel } from "@/lib/trips/cities";
import { getSiteContacts, type SiteContacts } from "@/lib/siteContacts";
import { qrCodePngBuffer } from "@/lib/tickets/qrcode";
import { ETICKET_INCLUDE, toETicket, type ETicket, type ETicketBooking, type ETicketJourney } from "@/lib/tickets/eTicket";

/**
 * A4 ticket PDF, one page per passenger, in the visitor's language: the
 * ticket with a boarding QR (opens /check/<reference> for the driver), the
 * route with boarding addresses, seat, bus and price, the «come 30–45 min
 * early» reminder and the short rules. Used by the passenger download, the
 * e-mail attachment and the staff bulk print.
 */

/** Prisma include that loads everything a ticket page needs. */
export const TICKET_PDF_INCLUDE = ETICKET_INCLUDE;
export type TicketPdfBooking = ETicketBooking;

const W = 595.28;
const H = 841.89;
const M = 40;

const C = {
  navy: rgb(11 / 255, 31 / 255, 58 / 255),
  brand: rgb(37 / 255, 99 / 255, 235 / 255),
  brandSoft: rgb(219 / 255, 234 / 255, 254 / 255),
  brandLight: rgb(147 / 255, 197 / 255, 253 / 255),
  ok: rgb(21 / 255, 128 / 255, 61 / 255),
  okSoft: rgb(220 / 255, 252 / 255, 231 / 255),
  warn: rgb(180 / 255, 83 / 255, 9 / 255),
  warnBar: rgb(245 / 255, 158 / 255, 11 / 255),
  warnSoft: rgb(254 / 255, 243 / 255, 199 / 255),
  red: rgb(185 / 255, 28 / 255, 28 / 255),
  redSoft: rgb(254 / 255, 226 / 255, 226 / 255),
  ink: rgb(31 / 255, 41 / 255, 55 / 255),
  muted: rgb(100 / 255, 116 / 255, 139 / 255),
  line: rgb(226 / 255, 232 / 255, 240 / 255),
  soft: rgb(248 / 255, 250 / 255, 252 / 255),
  white: rgb(1, 1, 1),
  whiteDim: rgb(0.78, 0.84, 0.92),
};

type Fonts = { font: PDFFont; bold: PDFFont };

/** Intl output uses no-break spaces; keep them printable in every viewer. */
const clean = (s: string) => s.replace(/[  ]/g, " ");

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const para of clean(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width || !line) line = next;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

function issuedDate(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(localeOf(lang), { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Madrid" }).format(new Date(iso));
}

export function stateTone(state: ETicket["state"]): { fg: RGB; bg: RGB } {
  if (state === "paid") return { fg: C.ok, bg: C.okSoft };
  if (state === "due") return { fg: C.warn, bg: C.warnSoft };
  if (state === "pending") return { fg: C.brand, bg: C.brandSoft };
  return { fg: C.red, bg: C.redSoft };
}

class Pen {
  constructor(
    readonly page: PDFPage,
    readonly f: Fonts
  ) {}
  /** Draw at a top-based y (distance from the top edge to the baseline). */
  text(s: string, x: number, top: number, size: number, opts: { bold?: boolean; color?: RGB; right?: boolean; center?: number } = {}) {
    const font = opts.bold ? this.f.bold : this.f.font;
    const str = clean(s);
    const w = font.widthOfTextAtSize(str, size);
    const px = opts.right ? x - w : opts.center != null ? x + (opts.center - w) / 2 : x;
    this.page.drawText(str, { x: px, y: H - top, size, font, color: opts.color ?? C.ink });
    return w;
  }
  /** Wrapped paragraph; returns the top of the next line. */
  para(s: string, x: number, top: number, size: number, width: number, opts: { bold?: boolean; color?: RGB; leading?: number } = {}) {
    const font = opts.bold ? this.f.bold : this.f.font;
    const lead = opts.leading ?? size * 1.4;
    let y = top;
    for (const line of wrap(s, font, size, width)) {
      this.text(line, x, y, size, opts);
      y += lead;
    }
    return y;
  }
  rect(x: number, top: number, w: number, h: number, color: RGB, border?: RGB) {
    this.page.drawRectangle({ x, y: H - top - h, width: w, height: h, color, ...(border ? { borderColor: border, borderWidth: 0.8 } : {}) });
  }
  pill(label: string, x: number, top: number, tone: { fg: RGB; bg: RGB }, size = 9) {
    const w = this.f.bold.widthOfTextAtSize(clean(label), size) + 16;
    this.rect(x, top - size - 4, w, size + 9, tone.bg);
    this.text(label, x + 8, top, size, { bold: true, color: tone.fg });
    return w;
  }
  hr(top: number, x1 = M, x2 = W - M) {
    this.page.drawLine({ start: { x: x1, y: H - top }, end: { x: x2, y: H - top }, thickness: 0.8, color: C.line });
  }
}

function drawJourney(pen: Pen, j: ETicketJourney, t: Dict, lang: Lang, top: number, width: number): number {
  const tt = t.ticket;
  const x = M;
  let y = top;
  const label = (j.kind === "return" ? tt.return : tt.outbound).toUpperCase();
  const lw = pen.pill(label, x, y, { fg: C.brand, bg: C.brandSoft }, 8);
  if (j.departAt) pen.text(longDate(j.departAt, lang), x + lw + 10, y, 11, { bold: true, color: C.navy });
  y += 26;

  const row = (time: string | null, city: string, kind: string, address: string | null) => {
    pen.text(time ?? "—", x, y + 4, 18, { bold: true, color: C.navy });
    pen.text(kind.toUpperCase(), x + 70, y - 6, 7, { bold: true, color: C.muted });
    pen.text(cityLabel(city, lang), x + 70, y + 7, 13, { bold: true, color: C.ink });
    let next = y + 22;
    if (address) next = pen.para(address, x + 70, next, 9, width - 70, { color: C.muted, leading: 12 });
    return next;
  };
  y = row(j.departAt?.slice(11, 16) ?? null, j.from, tt.boarding, j.boardAddress) + 12;
  // Overnight runs: say on which day the bus arrives.
  const arrivalDay =
    j.arriveAt && j.departAt && j.arriveAt.slice(0, 10) !== j.departAt.slice(0, 10)
      ? ` · ${longDate(j.arriveAt, lang, { year: false, weekday: "short" })}`
      : "";
  y = row(j.arriveAt?.slice(11, 16) ?? null, j.to, `${tt.dropoff}${arrivalDay}`, j.alightAddress) + 8;

  const seat = j.freeSeating ? tt.noSeat : fmt(tt.seatN, { n: j.seat ?? "" });
  const sw = pen.text(`${tt.seat}: `, x, y + 2, 11, { color: C.muted });
  pen.text(seat, x + sw, y + 2, 11, { bold: true, color: C.navy });
  y += 16;
  const facts = [`${tt.bus}: ${j.bus ?? tt.busTbd}`, j.carrier ? `${tt.carrier}: ${j.carrier}` : null].filter(Boolean).join("   ·   ");
  y = pen.para(facts, x, y, 9, width, { color: C.ink, leading: 12 });
  for (const leg of j.legs) {
    const legSeat = leg.seat != null ? fmt(tt.seatN, { n: leg.seat }) : tt.noSeat;
    y = pen.para(`${tt.transfer}: ${cityLabel(leg.from, lang)} → ${cityLabel(leg.to, lang)} · ${tt.seat} ${legSeat}${leg.bus ? ` · ${leg.bus}` : ""}`, x, y, 9, width, { color: C.muted, leading: 12 });
  }
  return y + 10;
}

async function drawTicketPage(pdf: PDFDocument, e: ETicket, fonts: Fonts, lang: Lang, contacts: SiteContacts): Promise<void> {
  const t = dictionaries[lang];
  const tt = t.ticket;
  const page = pdf.addPage([W, H]);
  const pen = new Pen(page, fonts);

  // Header band.
  pen.rect(0, 0, W, 86, C.navy);
  const aw = pen.text("Asol", M, 48, 22, { bold: true, color: C.white });
  pen.text(" BUS", M + aw, 48, 22, { bold: true, color: C.brandLight });
  pen.text(tt.pdfTitle, M, 68, 10, { color: C.whiteDim });
  pen.text(tt.reference, W - M, 36, 9, { color: C.whiteDim, right: true });
  pen.text(e.reference, W - M, 64, 24, { bold: true, color: C.white, right: true });

  // Status and issue date.
  const tone = stateTone(e.state);
  pen.pill(tt.status[e.state], M, 116, tone);
  pen.text(`${tt.issued}: ${issuedDate(e.issuedAt, lang)}`, W - M, 116, 9, { color: C.muted, right: true });

  // QR column.
  const qrSize = 150;
  const qrX = W - M - qrSize;
  const qrTop = 136;
  pen.rect(qrX - 8, qrTop - 8, qrSize + 16, qrSize + 58, C.soft, C.line);
  const qr = await pdf.embedPng(await qrCodePngBuffer(e.checkUrl));
  page.drawImage(qr, { x: qrX, y: H - qrTop - qrSize, width: qrSize, height: qrSize });
  pen.text(e.reference, qrX, qrTop + qrSize + 16, 11, { bold: true, center: qrSize });
  pen.para(tt.qrHint, qrX, qrTop + qrSize + 31, 8, qrSize, { color: C.muted, leading: 10 });

  // Passenger.
  const colW = qrX - 24 - M;
  pen.text(tt.passenger.toUpperCase(), M, 146, 8, { bold: true, color: C.muted });
  let y = pen.para(`${e.firstName} ${e.lastName}`, M, 166, 18, colW, { bold: true, color: C.navy, leading: 22 });
  pen.text(t.checkout.ageCategory[e.ageCategory as keyof Dict["checkout"]["ageCategory"]]?.split(" · ")[0] ?? e.ageCategory, M, y - 4, 10, { color: C.muted });
  y += 20;
  pen.hr(y - 6, M, M + colW);
  y += 12;

  // Journeys.
  for (const j of e.journeys) y = drawJourney(pen, j, t, lang, y, colW);
  if (e.openReturn && !e.journeys.some((j) => j.kind === "return")) {
    pen.pill(tt.openReturn, M, y, { fg: C.brand, bg: C.brandSoft }, 8);
    y += 22;
  }

  // Price.
  y = Math.max(y, qrTop + qrSize + 70) + 4;
  pen.rect(M, y, W - 2 * M, 48, C.soft, C.line);
  pen.text(tt.price.toUpperCase(), M + 14, y + 18, 8, { bold: true, color: C.muted });
  pen.text(money(e.price, lang), M + 14, y + 37, 16, { bold: true, color: C.navy });
  const right =
    e.state === "paid" ? tt.paid : e.toPay > 0 ? `${e.state === "due" ? tt.toPay : tt.status.pending}: ${money(e.toPay, lang)}` : tt.status[e.state];
  pen.text(right, W - M - 14, y + 30, 12, { bold: true, color: tone.fg, right: true });
  y += 66;

  // Reminder.
  const remLines = wrap(tt.arrive, fonts.bold, 10.5, W - 2 * M - 34);
  const remH = remLines.length * 15 + 16;
  pen.rect(M, y, W - 2 * M, remH, C.warnSoft);
  pen.rect(M, y, 4, remH, C.warnBar);
  pen.para(tt.arrive, M + 18, y + 20, 10.5, W - 2 * M - 34, { bold: true, color: C.ink, leading: 15 });
  y += remH + 22;

  // Short rules.
  pen.text(tt.rulesTitle, M, y, 11, { bold: true, color: C.navy });
  y += 16;
  for (const rule of tt.rules) {
    pen.text("•", M, y, 9, { color: C.brand, bold: true });
    y = pen.para(rule, M + 12, y, 9, W - 2 * M - 12, { color: C.ink, leading: 12.5 }) + 3;
  }

  // Footer.
  const phones = [contacts.phoneUa, contacts.phoneEs, contacts.phoneDe].filter(Boolean).join("   ·   ");
  pen.hr(H - 70);
  if (phones) pen.text(phones, M, H - 52, 9, { bold: true, color: C.navy });
  pen.text([contacts.website, contacts.email].filter(Boolean).join("   ·   "), M, H - 38, 8, { color: C.muted });
  pen.text(tt.pdfValid, W - M, H - 38, 8, { color: C.muted, right: true });
}

let fontCache: Promise<[Buffer, Buffer]> | null = null;
function fontBytes(): Promise<[Buffer, Buffer]> {
  const dir = path.join(process.cwd(), "assets", "fonts");
  fontCache ??= Promise.all([readFile(path.join(dir, "DejaVuSans.ttf")), readFile(path.join(dir, "DejaVuSans-Bold.ttf"))]);
  return fontCache;
}

/**
 * One PDF with one page per booking, in the given order. `origin` is the
 * site origin (e.g. "https://asolbus.com") used for the QR.
 */
export async function buildTicketsPdf(bookings: TicketPdfBooking[], origin: string, lang: Lang = "uk"): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regular, bold] = await fontBytes();
  const fonts: Fonts = { font: await pdf.embedFont(regular, { subset: true }), bold: await pdf.embedFont(bold, { subset: true }) };
  const contacts = await getSiteContacts().catch(() => null);
  pdf.setTitle(`Asol BUS — ${bookings.map((b) => b.reference).join(", ")}`);
  pdf.setAuthor("Asol BUS");
  for (const booking of bookings) {
    await drawTicketPage(pdf, toETicket(booking, origin), fonts, lang, contacts ?? ({} as SiteContacts));
  }
  return pdf.save();
}
