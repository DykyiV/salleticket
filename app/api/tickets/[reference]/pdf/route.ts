import { NextResponse, type NextRequest } from "next/server";
import { buildTicketsPdf } from "@/lib/tickets/pdf";
import { loadReadableBookings, PassAccessError } from "@/lib/tickets/passAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ reference: string }> };

/** Boarding-pass PDF. The owner, staff, or the guest browser that reserved it may download it. */
export async function GET(req: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const bookings = await loadReadableBookings(req, [params.reference]);
    const bytes = await buildTicketsPdf(bookings, req.nextUrl.origin);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${bookings[0].reference}.pdf"`,
      },
    });
  } catch (err) {
    if (err instanceof PassAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
