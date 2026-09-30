import { findStopForCity, mapsUrl, type BoardingStop } from "@/lib/routes/boarding";

export type BoardingPassModel = {
  reference: string;
  passengerName: string;
  phones: string[];
  fromCity: string;
  toCity: string;
  departureLabel: string;
  arrivalLabel: string;
  seatLabel: string;
  boardingPlace: string;
  coordinates: string | null;
  mapsUrl: string | null;
  busNumber: string;
  busPhone: string;
  dispatcherPhone: string;
};

type StopLike = BoardingStop;

type BusLike = { plate?: string | null; model?: string | null } | null;

export type BoardingPassInput = {
  reference: string;
  firstName: string;
  lastName: string;
  phone: string;
  phone2?: string | null;
  phone3?: string | null;
  ticket: {
    seatNumber?: number | null;
    trip?: {
      fromCity: string;
      toCity: string;
      departureTime: Date;
      arrivalTime: Date;
      departure?: {
        defaultBus?: string | null;
        busPhone?: string | null;
        dispatcherPhone?: string | null;
        bus?: BusLike;
        template?: {
          defaultBus?: string | null;
          busPhone?: string | null;
          dispatcherPhone?: string | null;
        } | null;
        stops?: StopLike[];
      } | null;
    } | null;
    legs?: { assignment?: { bus?: BusLike } | null }[];
  };
};

const KYIV = "Europe/Kyiv";

export function formatTripMoment(date: Date): string {
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: KYIV,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function busNumber(input: BoardingPassInput): string {
  const assigned = input.ticket.legs
    ?.map((leg) => leg.assignment?.bus?.plate?.trim())
    .find((plate) => plate);
  if (assigned) return assigned;
  const departure = input.ticket.trip?.departure;
  const plate = departure?.bus?.plate?.trim();
  if (plate) return plate;
  return departure?.defaultBus?.trim() || departure?.template?.defaultBus?.trim() || "не призначено";
}

export function toBoardingPass(input: BoardingPassInput): BoardingPassModel {
  const trip = input.ticket.trip;
  const departure = trip?.departure;
  const stop = findStopForCity(departure?.stops ?? [], trip?.fromCity);
  const place = stop?.boardingAddress || stop?.addressLabel || stop?.city || trip?.fromCity || "—";
  const coordinates =
    stop?.latitude != null && stop?.longitude != null
      ? `${stop.latitude.toFixed(5)}, ${stop.longitude.toFixed(5)}`
      : null;
  const phones = [input.phone, input.phone2, input.phone3]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);

  return {
    reference: input.reference,
    passengerName: `${input.firstName} ${input.lastName}`.trim(),
    phones,
    fromCity: trip?.fromCity ?? "—",
    toCity: trip?.toCity ?? "—",
    departureLabel: trip ? formatTripMoment(trip.departureTime) : "—",
    arrivalLabel: trip ? formatTripMoment(trip.arrivalTime) : "—",
    seatLabel: input.ticket.seatNumber != null ? String(input.ticket.seatNumber) : "без місця",
    boardingPlace: place,
    coordinates,
    mapsUrl: stop ? mapsUrl(stop) : null,
    busNumber: busNumber(input),
    busPhone: departure?.busPhone?.trim() || departure?.template?.busPhone?.trim() || "—",
    dispatcherPhone:
      departure?.dispatcherPhone?.trim() || departure?.template?.dispatcherPhone?.trim() || "—",
  };
}

export function boardingPassText(pass: BoardingPassModel): string {
  return [
    `Посадковий талон ${pass.reference}`,
    pass.passengerName,
    pass.phones.join(", "),
    `${pass.fromCity} → ${pass.toCity}`,
    `Виїзд: ${pass.departureLabel}`,
    `Прибуття: ${pass.arrivalLabel}`,
    `Місце посадки: ${pass.boardingPlace}`,
    pass.coordinates ? `Геолокація: ${pass.coordinates}` : "",
    pass.mapsUrl ? `Карта: ${pass.mapsUrl}` : "",
    `Номер автобуса: ${pass.busNumber}`,
    `Телефон автобуса: ${pass.busPhone}`,
    `Телефон диспетчера: ${pass.dispatcherPhone}`,
    `Місце: ${pass.seatLabel}`,
  ]
    .filter(Boolean)
    .join("\n");
}
