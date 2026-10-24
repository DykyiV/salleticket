import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { getLang } from "@/lib/i18n/server";
import { isLang } from "@/lib/i18n/config";
import { requestOrigin, viewableGroup } from "@/lib/tickets/eTicket";
import { buildTicketsPdf } from "@/lib/tickets/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ reference: string }> };

/**
 * A4 ticket PDF in the visitor's language (or ?lang=uk|es|en).
 * ?all=1 — every passenger of the order this viewer may see, one page each.
 */
export async function GET(req: NextRequest, props: Params) {
  const { reference } = await props.params;
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  const group = await viewableGroup(reference, guard.session);
  if (!group) return NextResponse.json({ error: "Квиток не знайдено" }, { status: 404 });
  const bookings = req.nextUrl.searchParams.get("all") === "1" ? group : group.filter((b) => b.reference === reference);

  const asked = req.nextUrl.searchParams.get("lang");
  const lang = isLang(asked) ? asked : await getLang();
  const bytes = await buildTicketsPdf(bookings, requestOrigin(req), lang);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="asolbus-${reference.replace(/[^A-Za-z0-9-]/g, "")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
