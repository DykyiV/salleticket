import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { requireAuth } from "@/lib/auth/guard";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";
import { qrCodePngBuffer } from "@/lib/tickets/qrcode";
import { formatUkDate } from "@/lib/routes/dates";
import { TICKET_STATUS_LABEL, TRIP_KIND_LABEL, AGE_LABEL } from "@/lib/tickets/labels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { reference: string } };

/** Ticket PDF: booking number, QR code, route, passenger, price. */
export async function GET(req: NextRequest, { params }: Params) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  const booking = await prisma.booking.findUnique({
    where: { reference: params.reference },
    include: {
      ticket: {
        include: {
          trip: { include: { carrier: true, departure: true } },
          returnTrip: true,
        },
      },
    },
  });
  if (!booking) {
    return NextResponse.json({ error: "Квиток не знайдено" }, { status: 404 });
  }
  if (
    booking.ticket.userId !== guard.session.sub &&
    !hasRoleAtLeast(guard.session.role, "AGENT")
  ) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const host = req.nextUrl.host;
  const proto = req.nextUrl.protocol.replace(":", "");
  const qrPayload = `${proto}://${host}/check/${booking.reference}`;

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontBytes = await readFile(
    path.join(process.cwd(), "assets", "fonts", "DejaVuSans.ttf")
  );
  const boldBytes = await readFile(
    path.join(process.cwd(), "assets", "fonts", "DejaVuSans-Bold.ttf")
  );
  const font = await pdf.embedFont(fontBytes);
  const bold = await pdf.embedFont(boldBytes);

  const page = pdf.addPage([420, 300]);
  const ink = rgb(0.12, 0.16, 0.23);
  const mute = rgb(0.42, 0.46, 0.52);
  const brand = rgb(0.02, 0.44, 0.67);

  page.drawText("Asol BUS — квиток", { x: 24, y: 268, size: 10, font, color: mute });
  page.drawText(booking.reference, {
    x: 24,
    y: 240,
    size: 22,
    font: bold,
    color: ink,
  });
  page.drawText(TICKET_STATUS_LABEL[booking.ticket.status] ?? booking.ticket.status, {
    x: 24,
    y: 224,
    size: 9,
    font,
    color: brand,
  });

  const trip = booking.ticket.trip;
  if (trip) {
    page.drawText(`${trip.fromCity} → ${trip.toCity}`, {
      x: 24,
      y: 198,
      size: 13,
      font,
      color: ink,
    });
    page.drawText(
      `${formatUkDate(trip.departureTime)} · ${trip.departureTime.toISOString().slice(11, 16)} · ${trip.carrier.name}`,
      { x: 24, y: 182, size: 9, font, color: mute }
    );
  }

  const seatLine =
    booking.ticket.tripKind !== "ONE_WAY"
      ? TRIP_KIND_LABEL[booking.ticket.tripKind] ?? ""
      : "";
  page.drawText(
    `Місце: ${booking.ticket.seatNumber != null ? booking.ticket.seatNumber : "без місць"}${seatLine ? ` · ${seatLine}` : ""}`,
    { x: 24, y: 164, size: 10, font, color: ink }
  );
  if (booking.ticket.returnTrip) {
    page.drawText(
      `Назад: ${booking.ticket.returnTrip.fromCity} → ${booking.ticket.returnTrip.toCity} · ${formatUkDate(booking.ticket.returnTrip.departureTime)}${booking.ticket.returnSeatNumber != null ? ` · місце ${booking.ticket.returnSeatNumber}` : ""}`,
      { x: 24, y: 150, size: 9, font, color: mute }
    );
  }

  page.drawText(`${booking.firstName} ${booking.lastName}`, {
    x: 24,
    y: 126,
    size: 11,
    font,
    color: ink,
  });
  page.drawText(
    `${AGE_LABEL[booking.ageCategory] ?? booking.ageCategory} · ${booking.phone}`,
    { x: 24, y: 112, size: 9, font, color: mute }
  );
  page.drawText(`До сплати: €${booking.finalPrice.toFixed(2)}`, {
    x: 24,
    y: 94,
    size: 11,
    font: bold,
    color: ink,
  });

  const qrImage = await pdf.embedPng(await qrCodePngBuffer(qrPayload));
  page.drawImage(qrImage, { x: 296, y: 156, width: 100, height: 100 });
  page.drawText("QR для посадки", { x: 306, y: 144, size: 8, font, color: mute });

  page.drawText("Демо — реальна оплата не проводиться.", {
    x: 24,
    y: 24,
    size: 7,
    font,
    color: mute,
  });

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${booking.reference}.pdf"`,
    },
  });
}
