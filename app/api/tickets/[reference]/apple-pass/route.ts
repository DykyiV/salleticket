import { NextResponse, type NextRequest } from "next/server";
import { ApplePassNotConfigured, buildApplePass } from "@/lib/tickets/applePass";
import { buildETicket } from "@/lib/tickets/eTicket";
import { loadReadableBookings, PassAccessError } from "@/lib/tickets/passAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ reference: string }> };

/** Signed Apple Wallet pass. The QR opens the same driver check as the printed ticket. */
export async function GET(req: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const bookings = await loadReadableBookings(req, [params.reference]);
    const booking = bookings[0];
    const bytes = await buildApplePass(buildETicket(booking), `${req.nextUrl.origin}/check/${booking.reference}`);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${booking.reference}.pkpass"`,
      },
    });
  } catch (err) {
    if (err instanceof PassAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof ApplePassNotConfigured) {
      return NextResponse.json(
        {
          error:
            "Apple Wallet ще не підключено. Додайте APPLE_PASS_TYPE_ID, APPLE_TEAM_ID, APPLE_PASS_CERT, APPLE_PASS_KEY і APPLE_WWDR_CERT.",
        },
        { status: 501 }
      );
    }
    throw err;
  }
}
