import { addUtcDays } from "@/lib/routes/dates";
import { formatTripMoment } from "@/lib/tickets/boardingPass";
import { AGE_LABEL, eur } from "@/lib/tickets/labels";

export type ETicketSegment = {
  order: number;
  fromCity: string;
  toCity: string;
  fromDetail: string;
  toDetail: string;
  depart: string;
  arrive: string;
  bus: string;
  seat: string;
};

export type ETicketLayover = {
  city: string;
  minutes: number;
};

export type ETicketModel = {
  reference: string;
  issued: string;
  passenger: string;
  phones: string;
  email: string;
  category: string;
  routeFrom: string;
  routeTo: string;
  depart: string;
  arrive: string;
  segments: ETicketSegment[];
  layovers: ETicketLayover[];
  price: string;
};

type StopLike = {
  city: string;
  outboundDay: number;
  outboundTime: string;
  addressLabel?: string | null;
  boardingAddress?: string | null;
};

type BusLike = { plate?: string | null; model?: string | null } | null;

export type ETicketInput = {
  reference: string;
  firstName: string;
  lastName: string;
  phone: string;
  phone2?: string | null;
  phone3?: string | null;
  email?: string | null;
  ageCategory: string;
  finalPrice: number;
  createdAt: Date;
  ticket: {
    seatNumber?: number | null;
    trip?: {
      fromCity: string;
      toCity: string;
      departureTime: Date;
      arrivalTime: Date;
      carrier?: { name: string } | null;
      departure?: {
        date: Date;
        defaultBus?: string | null;
        bus?: BusLike;
        stops?: StopLike[];
      } | null;
    } | null;
    legs?: {
      order: number;
      fromCity?: string | null;
      toCity?: string | null;
      seatNumber?: number | null;
      assignment?: {
        bus?: BusLike;
        leg?: { transferMinutes?: number | null; label?: string } | null;
      } | null;
    }[];
  };
};

function scheduleLabel(date: Date, day: number, time: string): string {
  const base = addUtcDays(date, Math.max(0, day - 1));
  const formatted = new Intl.DateTimeFormat("uk-UA", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(base);
  return `${formatted}, ${time}`;
}

function findStop(stops: StopLike[], city: string | null | undefined): StopLike | undefined {
  if (!city) return undefined;
  const needle = city.trim().toLowerCase();
  return stops.find((stop) => stop.city.trim().toLowerCase() === needle);
}

function place(stop: StopLike | undefined, city: string): string {
  return stop?.boardingAddress || stop?.addressLabel || city;
}

function busName(bus: BusLike, fallback?: string | null): string {
  const label = [bus?.model, bus?.plate].filter(Boolean).join(" ").trim();
  return label || fallback?.trim() || "автобус уточнюється";
}

function seatLabel(seat: number | null | undefined): string {
  return seat != null ? `місце ${seat}` : "без місця";
}

export function buildETicket(input: ETicketInput): ETicketModel {
  const trip = input.ticket.trip;
  const departure = trip?.departure;
  const stops = departure?.stops ?? [];
  const legs = [...(input.ticket.legs ?? [])].sort((a, b) => a.order - b.order);
  const phones = [input.phone, input.phone2, input.phone3].map((value) => value?.trim() ?? "").filter(Boolean);

  const segments: ETicketSegment[] =
    legs.length > 0
      ? legs.map((leg, index) => {
          const fromCity = leg.fromCity || (index === 0 ? trip?.fromCity : "") || "—";
          const toCity = leg.toCity || (index === legs.length - 1 ? trip?.toCity : "") || "—";
          const fromStop = findStop(stops, fromCity);
          const toStop = findStop(stops, toCity);
          const depart = departure && fromStop
            ? scheduleLabel(departure.date, fromStop.outboundDay, fromStop.outboundTime)
            : trip
              ? formatTripMoment(trip.departureTime)
              : "—";
          const arrive = departure && toStop
            ? scheduleLabel(departure.date, toStop.outboundDay, toStop.outboundTime)
            : trip
              ? formatTripMoment(trip.arrivalTime)
              : "—";
          return {
            order: index + 1,
            fromCity,
            toCity,
            fromDetail: place(fromStop, fromCity),
            toDetail: place(toStop, toCity),
            depart,
            arrive,
            bus: busName(leg.assignment?.bus ?? null, departure?.defaultBus),
            seat: seatLabel(leg.seatNumber ?? (index === 0 ? input.ticket.seatNumber : null)),
          };
        })
      : [
          {
            order: 1,
            fromCity: trip?.fromCity ?? "—",
            toCity: trip?.toCity ?? "—",
            fromDetail: place(findStop(stops, trip?.fromCity), trip?.fromCity ?? "—"),
            toDetail: place(findStop(stops, trip?.toCity), trip?.toCity ?? "—"),
            depart: trip ? formatTripMoment(trip.departureTime) : "—",
            arrive: trip ? formatTripMoment(trip.arrivalTime) : "—",
            bus: busName(departure?.bus ?? null, departure?.defaultBus),
            seat: seatLabel(input.ticket.seatNumber),
          },
        ];

  const layovers: ETicketLayover[] = [];
  if (legs.length > 1) {
    for (let i = 1; i < legs.length; i += 1) {
      const minutes = legs[i].assignment?.leg?.transferMinutes ?? 30;
      layovers.push({ city: segments[i - 1]?.toCity ?? "", minutes });
    }
  }

  return {
    reference: input.reference,
    issued: formatTripMoment(input.createdAt),
    passenger: `${input.lastName} ${input.firstName}`.trim().toUpperCase(),
    phones: phones.join(" · ") || "—",
    email: input.email?.trim() || "—",
    category: AGE_LABEL[input.ageCategory] ?? input.ageCategory,
    routeFrom: segments[0]?.fromCity ?? "—",
    routeTo: segments[segments.length - 1]?.toCity ?? "—",
    depart: segments[0]?.depart ?? "—",
    arrive: segments[segments.length - 1]?.arrive ?? "—",
    segments,
    layovers,
    price: eur(input.finalPrice),
  };
}
