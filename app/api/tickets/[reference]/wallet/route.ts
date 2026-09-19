import { NextResponse, type NextRequest } from "next/server";
import { SignJWT, importPKCS8 } from "jose";
import { requireAuth } from "@/lib/auth/guard";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { reference: string } };

/**
 * Google Wallet "Add to wallet" link. Needs env credentials:
 *   GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SA_EMAIL, GOOGLE_WALLET_SA_KEY
 * Without them the route explains what to configure instead of failing.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  const booking = await prisma.booking.findUnique({
    where: { reference: params.reference },
    include: { ticket: { include: { trip: true } } },
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

  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  const saEmail = process.env.GOOGLE_WALLET_SA_EMAIL;
  const saKey = process.env.GOOGLE_WALLET_SA_KEY?.replace(/\\n/g, "\n");
  if (!issuerId || !saEmail || !saKey) {
    return NextResponse.json(
      {
        error:
          "Google Wallet не налаштовано. Додайте GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SA_EMAIL і GOOGLE_WALLET_SA_KEY у секрети середовища.",
      },
      { status: 501 }
    );
  }

  const trip = booking.ticket.trip;
  const objectId = `${issuerId}.${booking.reference.replace(/[^A-Za-z0-9.]/g, "")}`;
  const payload = {
    iss: saEmail,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: [],
    payload: {
      eventTicketObjects: [
        {
          id: objectId,
          classId: `${issuerId}.asolbus_ticket`,
          state: "active",
          barcode: {
            type: "QR_CODE",
            value: booking.reference,
          },
          ticketHolderName: `${booking.firstName} ${booking.lastName}`,
          ticketNumber: booking.reference,
          eventName: trip
            ? { defaultValue: { language: "uk", value: `${trip.fromCity} → ${trip.toCity}` } }
            : undefined,
        },
      ],
    },
  };

  const key = await importPKCS8(saKey, "RS256");
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .sign(key);

  return NextResponse.redirect(`https://pay.google.com/gp/v/save/${jwt}`);
}
