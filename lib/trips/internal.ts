import { prisma } from "@/lib/db";
import { addUtcDays, todayUtc, utcDateOnly } from "@/lib/routes/dates";
import { priceForTrip } from "@/lib/pricing/grid";
import { cityNames } from "@/lib/trips/cities";

export type InternalTripOption = {
  id: string;
  fromCity: string;
  toCity: string;
  departureTime: string;
  arrivalTime: string;
  date: string;
  price: number;
  carrier: string;
  bus: string | null;
  hasAssignedSeats: boolean;
};

function toOption(trip: {
  id: string;
  fromCity: string;
  toCity: string;
  departureTime: Date;
  arrivalTime: Date;
  price: number;
  carrier: { name: string };
  departure: { hasAssignedSeats: boolean; defaultBus: string | null } | null;
}): InternalTripOption {
  return {
    id: trip.id,
    fromCity: trip.fromCity,
    toCity: trip.toCity,
    departureTime: trip.departureTime.toISOString(),
    arrivalTime: trip.arrivalTime.toISOString(),
    date: trip.departureTime.toISOString().slice(0, 10),
    price: trip.price,
    carrier: trip.carrier.name,
    bus: trip.departure?.defaultBus ?? null,
    hasAssignedSeats: trip.departure?.hasAssignedSeats ?? true,
  };
}

const tripInclude = {
  carrier: true,
  departure: { select: { hasAssignedSeats: true, defaultBus: true } },
} as const;

export async function listInternalTrips(options: {
  fromCity: string;
  toCity: string;
  date: string;
}): Promise<InternalTripOption[]> {
  const day = utcDateOnly(options.date);
  const next = addUtcDays(day, 1);
  const trips = await prisma.trip.findMany({
    where: {
      fromCity: { in: cityNames(options.fromCity) },
      toCity: { in: cityNames(options.toCity) },
      departureTime: { gte: day, lt: next },
      departureId: { not: null },
    },
    include: tripInclude,
    orderBy: { departureTime: "asc" },
  });
  return withGridPrices(trips);
}

export async function upcomingInternalTrips(options: {
  fromCity: string;
  toCity: string;
  take?: number;
}): Promise<InternalTripOption[]> {
  const trips = await prisma.trip.findMany({
    where: {
      fromCity: { in: cityNames(options.fromCity) },
      toCity: { in: cityNames(options.toCity) },
      departureTime: { gte: todayUtc() },
      departureId: { not: null },
    },
    include: tripInclude,
    orderBy: { departureTime: "asc" },
    take: options.take ?? 12,
  });
  return withGridPrices(trips);
}

async function withGridPrices(
  trips: Array<{
    id: string;
    fromCity: string;
    toCity: string;
    departureTime: Date;
    arrivalTime: Date;
    price: number;
    carrier: { name: string };
    departure: { hasAssignedSeats: boolean; defaultBus: string | null } | null;
  }>
): Promise<InternalTripOption[]> {
  const out: InternalTripOption[] = [];
  for (const trip of trips) {
    const option = toOption(trip);
    const { price } = await priceForTrip(prisma, {
      id: trip.id,
      price: trip.price,
      departureTime: trip.departureTime,
    });
    option.price = price;
    out.push(option);
  }
  return out;
}
