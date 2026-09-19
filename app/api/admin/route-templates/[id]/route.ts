import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { parseTemplateBody } from "@/lib/routes/templateBody";
import { toTemplateDTO } from "@/lib/routes/serialize";
import { RouteValidationError } from "@/lib/routes/validate";
import { utcDateOnly } from "@/lib/routes/dates";
import { propagateTemplateToDepartures } from "@/lib/routes/propagate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const include = {
  country: true,
  originCountry: true,
  stops: { orderBy: { sortOrder: "asc" as const } },
  _count: { select: { departures: true } },
};

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const template = await prisma.routeTemplate.findUnique({
    where: { id: params.id },
    include,
  });
  if (!template) {
    return NextResponse.json({ error: "Шаблон не знайдено" }, { status: 404 });
  }
  return NextResponse.json({ template: toTemplateDTO(template) });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const existing = await prisma.routeTemplate.findUnique({
    where: { id: params.id },
    include: { stops: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Шаблон не знайдено" }, { status: 404 });
  }

  try {
    const parsed = parseTemplateBody(body);
    const keepIds = parsed.stops.map((s) => s.id).filter(Boolean) as string[];

    const updated = await prisma.$transaction(async (tx) => {
      await tx.routeTemplate.update({
        where: { id: params.id },
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
        },
      });

      await tx.routeTemplateStop.deleteMany({
        where: {
          templateId: params.id,
          ...(keepIds.length ? { id: { notIn: keepIds } } : {}),
        },
      });

      const remaining = await tx.routeTemplateStop.findMany({
        where: { templateId: params.id },
      });
      for (let i = 0; i < remaining.length; i++) {
        await tx.routeTemplateStop.update({
          where: { id: remaining[i].id },
          data: { sortOrder: -(i + 1) },
        });
      }

      for (const stop of parsed.stops) {
        const data = {
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
        };
        if (stop.id && remaining.some((s) => s.id === stop.id)) {
          await tx.routeTemplateStop.update({
            where: { id: stop.id },
            data,
          });
        } else {
          await tx.routeTemplateStop.create({
            data: { templateId: params.id, ...data },
          });
        }
      }

      return tx.routeTemplate.findUniqueOrThrow({
        where: { id: params.id },
        include,
      });
    });

    let propagated = 0;
    const propagate = body.propagate as
      | { enabled?: boolean; from?: string; to?: string }
      | undefined;
    if (propagate?.enabled && propagate.from && propagate.to) {
      const result = await propagateTemplateToDepartures({
        templateId: params.id,
        from: utcDateOnly(propagate.from),
        to: utcDateOnly(propagate.to),
      });
      propagated = result.updated;
    }

    return NextResponse.json({
      template: toTemplateDTO(updated),
      propagated,
    });
  } catch (err) {
    if (err instanceof RouteValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update template" },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return guard.response;

  const count = await prisma.departure.count({
    where: { templateId: params.id },
  });
  if (count > 0) {
    return NextResponse.json(
      {
        error: `Неможливо видалити: є ${count} виїздів цього маршруту. Спочатку видаліть або залиште їх.`,
      },
      { status: 409 }
    );
  }

  try {
    await prisma.routeTemplate.delete({ where: { id: params.id } });
  } catch {
    return NextResponse.json({ error: "Шаблон не знайдено" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
