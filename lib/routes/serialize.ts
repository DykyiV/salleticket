import type {
  Country,
  Departure,
  DepartureStop,
  RouteTemplate,
  RouteTemplateStop,
} from "@prisma/client";
import { formatWeekdays, parseWeekdays } from "@/lib/routes/weekdays";
import { toIsoDate } from "@/lib/routes/dates";
import { resolveDirection } from "@/lib/routes/countries";

export type TemplateStopDTO = {
  id: string;
  sortOrder: number;
  city: string;
  outboundDay: number;
  outboundTime: string;
  returnDay: number;
  returnTime: string;
  addressLabel: string | null;
  boardingAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  visibleByDefault: boolean;
};

export type TemplateDTO = {
  id: string;
  countryId: string;
  countryName: string;
  countryCode: string;
  originCountryId: string | null;
  originCountryName: string;
  originCountryCode: string;
  name: string;
  originCity: string;
  destinationCity: string;
  departureWeekdays: number[];
  departureWeekdaysLabel: string;
  busPhone: string | null;
  dispatcherPhone: string | null;
  ukraineDepartureWeekday: number | null;
  ukraineReturnWeekday: number | null;
  defaultBus: string | null;
  comment: string | null;
  hasAssignedSeats: boolean;
  isActive: boolean;
  stops: TemplateStopDTO[];
  departureCount: number;
  createdAt: string;
  updatedAt: string;
};

export type DepartureStopDTO = {
  id: string;
  templateStopId: string | null;
  sortOrder: number;
  city: string;
  outboundDay: number;
  outboundTime: string;
  returnDay: number;
  returnTime: string;
  addressLabel: string | null;
  boardingAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  isVisible: boolean;
  saleEnabled: boolean;
};

export type DepartureDTO = {
  id: string;
  templateId: string;
  templateName: string;
  countryId: string;
  countryName: string;
  countryCode: string;
  originCountryId: string | null;
  originCountryName: string;
  originCountryCode: string;
  date: string;
  weekday: number;
  busPhone: string | null;
  dispatcherPhone: string | null;
  defaultBus: string | null;
  comment: string | null;
  ukraineDepartureWeekday: number | null;
  ukraineReturnWeekday: number | null;
  originCity: string;
  destinationCity: string;
  hasAssignedSeats: boolean;
  stops: DepartureStopDTO[];
};

type TemplateRecord = RouteTemplate & {
  country: Country;
  originCountry?: Country | null;
  stops: RouteTemplateStop[];
  _count?: { departures: number };
};

export function toTemplateStopDTO(stop: RouteTemplateStop): TemplateStopDTO {
  return {
    id: stop.id,
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
}

export function toTemplateDTO(row: TemplateRecord): TemplateDTO {
  const days = parseWeekdays(row.departureWeekdays);
  const direction = resolveDirection(row.originCountry, row.country);
  return {
    id: row.id,
    countryId: row.countryId,
    countryName: row.country.name,
    countryCode: direction.destinationCode,
    originCountryId: row.originCountryId,
    originCountryName: direction.originName,
    originCountryCode: direction.originCode,
    name: row.name,
    originCity: row.originCity,
    destinationCity: row.destinationCity,
    departureWeekdays: days,
    departureWeekdaysLabel: formatWeekdays(days),
    busPhone: row.busPhone,
    dispatcherPhone: row.dispatcherPhone,
    ukraineDepartureWeekday: row.ukraineDepartureWeekday,
    ukraineReturnWeekday: row.ukraineReturnWeekday,
    defaultBus: row.defaultBus,
    comment: row.comment,
    hasAssignedSeats: row.hasAssignedSeats,
    isActive: row.isActive,
    stops: [...row.stops]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(toTemplateStopDTO),
    departureCount: row._count?.departures ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toDepartureStopDTO(stop: DepartureStop): DepartureStopDTO {
  return {
    id: stop.id,
    templateStopId: stop.templateStopId,
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
    isVisible: stop.isVisible,
    saleEnabled: stop.saleEnabled,
  };
}

type DepartureRecord = Departure & {
  template: RouteTemplate & {
    country: Country;
    originCountry?: Country | null;
  };
  stops: DepartureStop[];
};

export function toDepartureDTO(row: DepartureRecord): DepartureDTO {
  const direction = resolveDirection(
    row.template.originCountry,
    row.template.country
  );
  return {
    id: row.id,
    templateId: row.templateId,
    templateName: row.template.name,
    countryId: row.template.countryId,
    countryName: row.template.country.name,
    countryCode: direction.destinationCode,
    originCountryId: row.template.originCountryId,
    originCountryName: direction.originName,
    originCountryCode: direction.originCode,
    date: toIsoDate(row.date),
    weekday: row.weekday,
    busPhone: row.busPhone,
    dispatcherPhone: row.dispatcherPhone,
    defaultBus: row.defaultBus,
    comment: row.comment,
    ukraineDepartureWeekday: row.ukraineDepartureWeekday,
    ukraineReturnWeekday: row.ukraineReturnWeekday,
    originCity: row.template.originCity,
    destinationCity: row.template.destinationCity,
    hasAssignedSeats: row.hasAssignedSeats,
    stops: [...row.stops]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(toDepartureStopDTO),
  };
}

export function stopCreateData(stop: {
  sortOrder: number;
  city: string;
  outboundDay: number;
  outboundTime: string;
  returnDay: number;
  returnTime: string;
  addressLabel: string | null;
  boardingAddress: string | null;
  latitude: number | null;
  longitude: number | null;
}) {
  return {
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
  };
}
