"use client";

import { useState } from "react";
import SeatSelectModal from "@/components/booking/SeatSelectModal";
import Icon, { type IconName } from "@/components/site/Icon";
import { fmt, plural, useI18n } from "@/lib/i18n/client";
import { money } from "@/lib/i18n/format";
import { cityLabel } from "@/lib/trips/cities";
import { transfersOf } from "@/lib/results/filter";
import type { Trip } from "@/lib/mockTrips";
import type { BusFeature } from "@/lib/buses/features";

const FEATURE_ICON: Record<BusFeature, IconName> = {
  wifi: "wifi",
  sockets: "sockets",
  ac: "ac",
  wc: "wc",
  water: "water",
};

/** Days between departure and arrival (0 = same day). */
export function dayOffset(trip: Trip): number {
  if (trip.departureAt && trip.arrivalAt) {
    const a = Date.parse(trip.departureAt.slice(0, 10));
    const b = Date.parse(trip.arrivalAt.slice(0, 10));
    if (Number.isFinite(a) && Number.isFinite(b)) return Math.max(0, Math.round((b - a) / 86_400_000));
  }
  const [h, m] = trip.departure.split(":").map(Number);
  return Math.floor(((h || 0) * 60 + (m || 0) + trip.durationMinutes) / 1440);
}

export default function TripResultCard({
  trip,
  passengers,
  onlineDiscountPercent,
  date,
  tripKind,
  returnDate,
}: {
  trip: Trip;
  passengers: number;
  /** 0 when online payment is off — then no online price is shown. */
  onlineDiscountPercent: number;
  date?: string;
  tripKind: string;
  returnDate?: string;
}) {
  const { t, lang } = useI18n();
  const r = t.results;
  const c = r.card;
  const [open, setOpen] = useState(false);

  const hours = Math.floor(trip.durationMinutes / 60);
  const minutes = trip.durationMinutes % 60;
  const duration = minutes ? fmt(c.hm, { h: hours, m: minutes }) : fmt(c.h, { h: hours });
  const days = dayOffset(trip);
  const transfers = transfersOf(trip);
  const seatsKnown = trip.hasAssignedSeats !== false;
  const soldOut = seatsKnown && trip.seatsLeft <= 0;
  const notEnough = seatsKnown && !soldOut && trip.seatsLeft < passengers;
  const onlinePrice = onlineDiscountPercent > 0 ? Math.round(trip.price * (1 - onlineDiscountPercent / 100) * 100) / 100 : null;
  const features = trip.features ?? [];
  const amenities = t.buses.amenities as Record<string, string>;
  const busLine = [trip.busCategory ? r.categories[trip.busCategory] : null, trip.busType || null].filter(Boolean).join(" · ");

  return (
    <article
      aria-label={`${trip.departure} ${cityLabel(trip.from, lang)} — ${trip.arrival} ${cityLabel(trip.to, lang)}, ${money(trip.price, lang)}`}
      className="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-200/70 transition hover:ring-brand-300"
    >
      <div className="grid md:grid-cols-[1fr_15rem]">
        <div className="p-4 sm:p-5">
          {/* Times and cities */}
          <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3">
            <div>
              <p className="text-2xl font-bold tabular-nums text-navy sm:text-[1.75rem]">{trip.departure}</p>
              <p className="mt-0.5 font-semibold text-ink">{cityLabel(trip.from, lang)}</p>
              {trip.fromStation ? <p className="max-w-[9rem] truncate text-xs text-ink-soft sm:max-w-[14rem]">{trip.fromStation}</p> : null}
            </div>
            <div className="flex flex-col items-center px-1 pt-2">
              <span className="text-xs font-medium text-ink-soft">{duration}</span>
              <div className="mt-1 flex w-full items-center gap-1" aria-hidden="true">
                <span className="h-2 w-2 shrink-0 rounded-full border-2 border-brand-600" />
                <span className="h-0.5 flex-1 rounded bg-brand-200" />
                {transfers > 0 ? <span className="h-2 w-2 shrink-0 rounded-full bg-warn" /> : null}
                {transfers > 0 ? <span className="h-0.5 flex-1 rounded bg-brand-200" /> : null}
                <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" />
              </div>
              <span className={`mt-1 text-xs font-semibold ${transfers ? "text-warn-700" : "text-ok-700"}`}>
                {transfers
                  ? `${plural(lang, transfers, c.transfers)}${trip.transferCity ? ` · ${fmt(c.via, { city: cityLabel(trip.transferCity, lang) })}` : ""}`
                  : c.directShort}
              </span>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums text-navy sm:text-[1.75rem]">
                {trip.arrival}
                {days > 0 ? (
                  <sup className="ml-0.5 align-super text-xs font-semibold text-warn-700">{fmt(c.nextDay, { n: days })}</sup>
                ) : null}
              </p>
              <p className="mt-0.5 font-semibold text-ink">{cityLabel(trip.to, lang)}</p>
              {trip.toStation ? <p className="ml-auto max-w-[9rem] truncate text-xs text-ink-soft sm:max-w-[14rem]">{trip.toStation}</p> : null}
            </div>
          </div>

          {/* Carrier, bus, services */}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-100 pt-3 text-sm">
            <span className="inline-flex items-center gap-2 font-semibold text-navy">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy text-[11px] font-bold text-white" aria-hidden="true">
                {trip.carrierShort}
              </span>
              {trip.carrier}
            </span>
            {busLine ? <span className="text-ink-soft">{busLine}</span> : null}
            <ul className="flex flex-wrap gap-1.5" aria-label={r.amenities}>
              {features.map((f) => (
                <li key={f} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-ink-muted">
                  <Icon name={FEATURE_ICON[f]} className="h-3.5 w-3.5 text-brand-600" />
                  {amenities[f] ?? f}
                </li>
              ))}
              {trip.luggagePieces ? (
                <li className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-ink-muted">
                  <Icon name="luggage" className="h-3.5 w-3.5 text-brand-600" />
                  {plural(lang, trip.luggagePieces, c.luggage)}
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        {/* Price and action */}
        <div className="flex items-center justify-between gap-3 border-t border-dashed border-slate-200 bg-slate-50/70 p-4 sm:p-5 md:flex-col md:items-stretch md:justify-center md:border-l md:border-t-0">
          <div className="md:text-right">
            <p className="text-2xl font-bold text-navy sm:text-3xl">{money(trip.price, lang)}</p>
            <p className="text-xs text-ink-soft">{c.perPassenger}</p>
            {onlinePrice != null ? (
              <p className="mt-0.5 text-xs font-semibold text-ok-700">{fmt(c.online, { price: money(onlinePrice, lang) })}</p>
            ) : null}
            <p
              className={`mt-1 text-xs font-medium ${
                soldOut || notEnough ? "text-rose-700" : seatsKnown && trip.seatsLeft <= 5 ? "text-warn-700" : "text-ink-soft"
              }`}
            >
              {!seatsKnown
                ? c.freeSeating
                : soldOut
                  ? c.soldOut
                  : notEnough
                    ? fmt(c.notEnough, { n: passengers })
                    : trip.seatsLeft <= 5
                      ? plural(lang, trip.seatsLeft, c.fewSeats)
                      : plural(lang, trip.seatsLeft, c.seatsLeft)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={soldOut || notEnough}
            className="btn-primary shrink-0 px-4 py-3 text-sm sm:px-5"
          >
            <Icon name="seat" className="h-4 w-4" />
            {c.choose}
          </button>
        </div>
      </div>

      {open ? (
        <SeatSelectModal
          trip={trip}
          date={date}
          tripKind={tripKind}
          returnDate={returnDate}
          onlineDiscountPercent={onlineDiscountPercent}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </article>
  );
}
