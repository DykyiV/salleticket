import { NextResponse, type NextRequest } from "next/server";
import { limitPublic, QUOTE_PER_IP } from "@/lib/security/publicLimit";
import { grandesTourEnabled } from "@/lib/carriers/grandes-tour/client";
import { gtCheckCard, gtFare, gtKindOfType, gtLegFromKey, gtPassengerTypes } from "@/lib/carriers/grandes-tour/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  tripId?: string;
  returnTripId?: string | null;
  /** Travel date YYYY-MM-DD. */
  date?: string;
  /** GT passenger type per passenger (null = adult). */
  typeIds?: (number | null)[];
  card?: string | null;
};

/** Checkout preview of Grandes Tour fares (age types + discount card). */
export async function POST(req: NextRequest) {
  const limited = await limitPublic(req, "quote", QUOTE_PER_IP);
  if (limited) return limited;
  if (!grandesTourEnabled()) return NextResponse.json({ error: "Not available" }, { status: 404 });
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const to = gtLegFromKey(body.tripId ?? "");
  const back = body.returnTripId ? gtLegFromKey(body.returnTripId) : null;
  const typeIds = (body.typeIds ?? []).slice(0, 6);
  if (!to || !typeIds.length) return NextResponse.json({ error: "tripId and typeIds are required" }, { status: 400 });

  try {
    const card = await gtCheckCard(body.card);
    const cardNo = card.status === "ok" ? card.number : null;
    const types = await gtPassengerTypes(to);
    const fares = await Promise.all(
      typeIds.map((id) => {
        const type = id != null ? types.find((t) => t.id === id) : undefined;
        return gtFare({ to, back, kind: type ? gtKindOfType(type) : "ADULT", typeId: type?.id, card: cardNo });
      }),
    );
    return NextResponse.json({
      fares: fares.map((f) => ({ kind: f.kind, price: f.price, priceBeforeDiscount: f.priceBeforeDiscount })),
      card,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
