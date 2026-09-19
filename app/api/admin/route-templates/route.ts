import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { RouteValidationError } from "@/lib/routes/validate";
import { parseTemplateBody } from "@/lib/routes/templateBody";
import { toTemplateDTO } from "@/lib/routes/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const include = {
  country: true,
  originCountry: true,
  stops: { orderBy: { sortOrder: "asc" as const } },
  _count: { select: { departures: true } },
};

export async function GET() {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const templates = await prisma.routeTemplate.findMany({
    include,
    orderBy: [{ country: { name: "asc" } }, { name: "asc" }],
  });
  return NextResponse.json({
    templates: templates.map(toTemplateDTO),
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const parsed = parseTemplateBody(body);
    const created = await prisma.routeTemplate.create({
      data: {
        countryId: parsed.countryId,
        originCountryId: parsed.originCountryId,
        name: parsed.name,
        originCity: parsed.originCity,
        destinationCity: parsed.destinationCity,
        departureWeekdays: parsed.departureWeekdays,
        busPhone: parsed.busPhone,
        dispatcherPhone: parsed.dispatcherPhone,
        ukraineDepartureWeekday: parsed.ukraineDepartureWeekday,
        ukraineReturnWeekday: parsed.ukraineReturnWeekday,
        defaultBus: parsed.defaultBus,
        comment: parsed.comment,
        hasAssignedSeats: parsed.hasAssignedSeats,
        allowSegmentSales: parsed.allowSegmentSales,
        isActive: parsed.isActive,
        stops: {
          create: parsed.stops.map((stop) => ({
            sortOrder: stop.sortOrder,
            city: stop.city,
            outboundDay: stop.outboundDay,
            outboundTime: stop.outboundTime,
            returnDay: stop.returnDay,
            returnTime: stop.returnTime,
            addressLabel: stop.addressLabel,
            boardingAddress: stop.boardingAddress,
            latitude: stop.latitude,
            longitude: stop.longitude,
            visibleByDefault: stop.visibleByDefault,
          })),
        },
      },
      include,
    });
    return NextResponse.json({ template: toTemplateDTO(created) }, { status: 201 });
  } catch (err) {
    if (err instanceof RouteValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save template" },
      { status: 400 }
    );
  }
}
