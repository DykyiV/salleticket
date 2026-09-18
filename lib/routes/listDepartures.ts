import { prisma } from "@/lib/db";
import { addUtcDays, todayUtc, utcDateOnly } from "@/lib/routes/dates";
import { toDepartureDTO, type DepartureDTO } from "@/lib/routes/serialize";

export const DEPARTURE_PAGE_SIZE = 15;
export const DEPARTURE_HORIZON_DAYS = 30;

export const departureListInclude = {
  template: { include: { country: true, originCountry: true } },
  stops: { orderBy: { sortOrder: "asc" as const } },
  bus: { select: { id: true, plate: true } },
};

export type DepartureCountryOption = {
  id: string;
  name: string;
  code: string | null;
};

export type DepartureRouteOption = {
  id: string;
  name: string;
  originCity: string;
  destinationCity: string;
  countryId: string;
  originCountryId: string | null;
};

export type DepartureListQuery = {
  from?: string | null;
  to?: string | null;
  templateId?: string | null;
  countryId?: string | null;
  page?: string | number | null;
  pageSize?: string | number | null;
};

export type DepartureListResult = {
  from: string;
  to: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  departures: DepartureDTO[];
};

function parsePage(raw: string | number | null | undefined, fallback = 1): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return n;
}

function parsePageSize(raw: string | number | null | undefined): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 1) return DEPARTURE_PAGE_SIZE;
  return Math.min(n, 50);
}

export function defaultDepartureRange(): { from: Date; to: Date } {
  const from = todayUtc();
  return { from, to: addUtcDays(from, DEPARTURE_HORIZON_DAYS) };
}

export function routeMatchesCountry(
  route: Pick<DepartureRouteOption, "countryId" | "originCountryId">,
  countryId: string
): boolean {
  if (!countryId) return true;
  return route.countryId === countryId || route.originCountryId === countryId;
}

export async function listDepartures(
  query: DepartureListQuery
): Promise<DepartureListResult> {
  const fallback = defaultDepartureRange();
  const from = query.from ? utcDateOnly(query.from) : fallback.from;
  const to = query.to ? utcDateOnly(query.to) : fallback.to;
  const pageSize = parsePageSize(query.pageSize);
  const page = parsePage(query.page);
  const templateId = query.templateId?.trim() || undefined;
  const countryId = query.countryId?.trim() || undefined;

  const where = {
    date: { gte: from, lte: to },
    ...(templateId ? { templateId } : {}),
    ...(countryId
      ? {
          template: {
            OR: [{ countryId }, { originCountryId: countryId }],
          },
        }
      : {}),
  };

  const total = await prisma.departure.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const rows = await prisma.departure.findMany({
    where,
    include: departureListInclude,
    orderBy: [
      { date: "asc" },
      { template: { originCountry: { name: "asc" } } },
      { template: { country: { name: "asc" } } },
      { template: { name: "asc" } },
    ],
    skip: (safePage - 1) * pageSize,
    take: pageSize,
  });

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    page: safePage,
    pageSize,
    total,
    totalPages,
    departures: rows.map(toDepartureDTO),
  };
}

export async function listDepartureFilterOptions(): Promise<{
  countries: DepartureCountryOption[];
  routes: DepartureRouteOption[];
}> {
  const [countries, routes] = await Promise.all([
    prisma.country.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true },
    }),
    prisma.routeTemplate.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        originCity: true,
        destinationCity: true,
        countryId: true,
        originCountryId: true,
      },
    }),
  ]);

  const used = new Set<string>();
  for (const route of routes) {
    used.add(route.countryId);
    if (route.originCountryId) used.add(route.originCountryId);
  }

  return {
    countries: countries.filter((c) => used.has(c.id)),
    routes,
  };
}
