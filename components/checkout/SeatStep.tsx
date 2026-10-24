"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/site/Icon";
import HoldTimer from "@/components/checkout/HoldTimer";
import SeatMapView, { seatPrice } from "@/components/checkout/SeatMapView";
import { fmt, plural, useI18n } from "@/lib/i18n/client";
import { money, shortDate } from "@/lib/i18n/format";
import { cityLabel } from "@/lib/trips/cities";
import { emptySeatLayout, findSeat, type BusLayout } from "@/lib/seats";
import type { Trip } from "@/lib/mockTrips";

const MAX_SEATS = 6;

type ReturnOption = {
  id: string;
  fromCity: string;
  toCity: string;
  departureTime: string;
  price: number;
  carrier: string;
  hasAssignedSeats: boolean;
};

type Leg = NonNullable<Trip["legSegments"]>[number];

export type SeatStepProps = {
  trip: Trip;
  /** carrierId, tripId, from, to, date, fi, ti — passed on to the checkout. */
  tripQuery: string;
  tripKind: string;
  returnDate?: string;
  passengers: number;
  pax: { adults: number; children: number; seniors: number };
  today: string;
};

/** Step 2: seats for every passenger (and every leg / the way back). */
export default function SeatStep(props: SeatStepProps) {
  const { trip } = props;
  const router = useRouter();
  const { t, lang } = useI18n();
  const s = t.seat;
  const [count, setCount] = useState(Math.min(MAX_SEATS, Math.max(1, props.passengers)));
  const [layout, setLayout] = useState<BusLayout | null>(null);
  const [virtual, setVirtual] = useState(false);
  const [seats, setSeats] = useState<number[]>([]);
  const [legLayouts, setLegLayouts] = useState<Record<string, BusLayout>>({});
  const [legSeats, setLegSeats] = useState<Record<string, number[]>>({});
  const [retDate, setRetDate] = useState(props.returnDate ?? "");
  const [returnTrips, setReturnTrips] = useState<ReturnOption[] | null>(null);
  const [returnTripId, setReturnTripId] = useState<string | null>(null);
  const [returnLayout, setReturnLayout] = useState<BusLayout | null>(null);
  const [returnSeats, setReturnSeats] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [holdVersion, setHoldVersion] = useState(0);

  const roundTrip = props.tripKind === "ROUND_TRIP";
  const assignsSeats = trip.hasAssignedSeats !== false;
  const legs = trip.legSegments ?? [];
  const hasLegs = legs.length > 1;
  const segment =
    trip.fromStopIndex != null && trip.toStopIndex != null
      ? { fromIndex: trip.fromStopIndex, toIndex: trip.toStopIndex }
      : null;

  const fetchLayout = useCallback(
    async (tripId: string, seg?: { fromIndex: number; toIndex: number } | null, assignmentId?: string) => {
      const q = new URLSearchParams();
      if (seg) {
        q.set("fromIndex", String(seg.fromIndex));
        q.set("toIndex", String(seg.toIndex));
      }
      if (assignmentId) q.set("assignmentId", assignmentId);
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/seats?${q}`, { cache: "no-store" }).catch(() => null);
      const data = res?.ok ? ((await res.json()) as { layout?: BusLayout; virtual?: boolean }) : {};
      return { layout: data.layout ?? emptySeatLayout(), virtual: Boolean(data.virtual) };
    },
    []
  );

  const reloadMain = useCallback(async () => {
    const r = await fetchLayout(trip.id, segment, hasLegs ? legs[0]?.assignmentId : undefined);
    setLayout(r.layout);
    setVirtual(r.virtual);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchLayout, trip.id, trip.fromStopIndex, trip.toStopIndex]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const r = await fetchLayout(trip.id, segment, hasLegs ? legs[0]?.assignmentId : undefined);
      if (!alive) return;
      setLayout(r.layout);
      setVirtual(r.virtual);
      if (hasLegs) {
        const entries = await Promise.all(
          legs.slice(1).map(async (leg) => [leg.legId, (await fetchLayout(trip.id, { fromIndex: leg.fromIndex, toIndex: leg.toIndex }, leg.assignmentId)).layout] as const)
        );
        if (alive) setLegLayouts(Object.fromEntries(entries));
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id]);

  // Return trips for the chosen date.
  useEffect(() => {
    if (!roundTrip || !retDate) return;
    let alive = true;
    const q = new URLSearchParams({ from: trip.to, to: trip.from, date: retDate });
    fetch(`/api/trips?${q}`)
      .then((r) => r.json())
      .then((data: { trips?: ReturnOption[] }) => {
        if (!alive) return;
        setReturnTrips(data.trips ?? []);
        setReturnTripId(null);
        setReturnLayout(null);
        setReturnSeats([]);
      })
      .catch(() => alive && setReturnTrips([]));
    return () => {
      alive = false;
    };
  }, [roundTrip, retDate, trip.from, trip.to]);

  const hold = async (tripId: string, seatNumber: number, seg: { fromIndex: number; toIndex: number } | null) => {
    if (virtual) return true;
    const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/holds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seatNumber, fromStopIndex: seg?.fromIndex ?? null, toStopIndex: seg?.toIndex ?? null }),
    }).catch(() => null);
    if (!res || !res.ok) {
      const data = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
      setError(res?.status === 409 ? s.seatTaken : (data.error ?? s.seatTaken));
      return false;
    }
    setHoldVersion((v) => v + 1);
    return true;
  };

  const release = (tripId: string, seatNumber: number) => {
    if (virtual) return;
    void fetch(`/api/trips/${encodeURIComponent(tripId)}/holds`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seatNumber }),
    })
      .catch(() => {})
      .finally(() => setHoldVersion((v) => v + 1));
  };

  const toggleIn = async (
    list: number[],
    setList: (l: number[]) => void,
    n: number,
    tripId: string,
    seg: { fromIndex: number; toIndex: number } | null,
    onFail?: () => void
  ) => {
    setError(null);
    if (list.includes(n)) {
      setList(list.filter((x) => x !== n));
      release(tripId, n);
      return;
    }
    if (list.length >= count) {
      // Replace the last pick so a tap always does something useful.
      const last = list[list.length - 1];
      setBusy(true);
      if (await hold(tripId, n, seg)) {
        release(tripId, last);
        setList([...list.slice(0, -1), n]);
      } else onFail?.();
      setBusy(false);
      return;
    }
    setBusy(true);
    if (await hold(tripId, n, seg)) setList([...list, n]);
    else onFail?.();
    setBusy(false);
  };

  const changeCount = (next: number) => {
    const c = Math.min(MAX_SEATS, Math.max(1, next));
    if (c < seats.length) {
      seats.slice(c).forEach((n) => release(trip.id, n));
      setSeats(seats.slice(0, c));
    }
    if (c < returnSeats.length && returnTripId) {
      returnSeats.slice(c).forEach((n) => release(returnTripId, n));
      setReturnSeats(returnSeats.slice(0, c));
    }
    setCount(c);
  };

  const mainPrice = (n: number) => {
    const seat = layout ? findSeat(layout, n) : null;
    return seat ? seatPrice(trip.price, seat) : trip.price;
  };
  const returnOption = returnTrips?.find((r) => r.id === returnTripId) ?? null;
  const outboundTotal = assignsSeats && !virtual ? seats.reduce((sum, n) => sum + mainPrice(n), 0) : trip.price * count;
  const returnTotal = roundTrip && returnOption ? returnOption.price * count : 0;
  const total = Math.round((outboundTotal + returnTotal) * 100) / 100;

  const needMain = assignsSeats && !virtual ? count - seats.length : 0;
  const legsComplete = !hasLegs || legs.slice(1).every((leg) => (legSeats[leg.legId] ?? []).length === count);
  const returnComplete =
    !roundTrip ||
    (returnTripId != null && (!returnLayout?.hasAssignedSeats || returnSeats.length === count));
  const canContinue = needMain === 0 && legsComplete && returnComplete && (!assignsSeats || virtual || layout != null);

  const proceed = () => {
    if (!canContinue) {
      setError(needMain > 0 ? plural(lang, needMain, s.needSeats) : !returnComplete ? s.needReturn : plural(lang, 1, s.needSeats));
      return;
    }
    const q = new URLSearchParams(props.tripQuery);
    q.set("tripKind", props.tripKind);
    q.set("passengers", String(count));
    if (seats.length) q.set("seats", seats.join(","));
    q.set("adults", String(props.pax.adults));
    if (props.pax.children) q.set("children", String(props.pax.children));
    if (props.pax.seniors) q.set("seniors", String(props.pax.seniors));
    if (hasLegs) {
      q.set(
        "legs",
        JSON.stringify(
          legs.map((leg, i) => ({
            legId: leg.legId,
            assignmentId: leg.assignmentId,
            fromStopIndex: leg.fromIndex,
            toStopIndex: leg.toIndex,
            fromCity: leg.fromCity,
            toCity: leg.toCity,
            seats: i === 0 ? seats : (legSeats[leg.legId] ?? []),
          }))
        )
      );
    }
    if (roundTrip && returnTripId) {
      q.set("returnTripId", returnTripId);
      if (returnSeats.length) q.set("returnSeats", returnSeats.join(","));
      if (retDate) q.set("returnDate", retDate);
    }
    router.push(`/booking?${q.toString()}`);
  };

  const legTitle = (leg: Leg, i: number) =>
    fmt(s.leg, {
      n: i + 1,
      from: cityLabel(leg.fromCity || trip.from, lang),
      to: cityLabel(leg.toCity || trip.to, lang),
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="min-w-0 space-y-5">
        <HoldTimer version={holdVersion} />

        {/* Passengers count */}
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-200/70">
          <div>
            <p className="font-semibold text-navy">{s.passengers}</p>
            <p className="text-sm text-ink-soft" aria-live="polite">
              {needMain > 0 ? fmt(s.pickFor, { n: seats.length + 1 }) : s.allPicked}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={`${t.search.decrease}: ${s.passengers}`}
              onClick={() => changeCount(count - 1)}
              disabled={count <= 1}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-navy hover:border-brand-400 disabled:opacity-40"
            >
              <Icon name="minus" className="h-4 w-4" />
            </button>
            <span className="w-5 text-center text-lg font-bold tabular-nums">{count}</span>
            <button
              type="button"
              aria-label={`${t.search.increase}: ${s.passengers}`}
              onClick={() => changeCount(count + 1)}
              disabled={count >= MAX_SEATS}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-navy hover:border-brand-400 disabled:opacity-40"
            >
              <Icon name="plus" className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Outbound map */}
        <section className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-200/70 sm:p-5">
          {hasLegs ? <h2 className="mb-3 font-semibold text-navy">{legTitle(legs[0], 0)}</h2> : null}
          {!assignsSeats || virtual ? (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-ink-muted">{s.freeSeating}</p>
          ) : layout ? (
            <SeatMapView
              layout={layout}
              selected={seats}
              basePrice={trip.price}
              busy={busy}
              onToggle={(n) => void toggleIn(seats, setSeats, n, trip.id, segment, () => void reloadMain())}
            />
          ) : (
            <p className="text-sm text-ink-soft">{s.loading}</p>
          )}
        </section>

        {hasLegs ? (
          <>
            <p className="rounded-xl bg-warn-50 px-4 py-3 text-sm text-warn-700 ring-1 ring-warn-100">
              {fmt(s.transferNote, { city: cityLabel(trip.transferCity ?? legs[0].toCity, lang) })}
            </p>
            {legs.slice(1).map((leg, i) => (
              <section key={leg.legId} className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-200/70 sm:p-5">
                <h2 className="mb-3 font-semibold text-navy">{legTitle(leg, i + 1)}</h2>
                {legLayouts[leg.legId] ? (
                  <SeatMapView
                    layout={legLayouts[leg.legId]}
                    selected={legSeats[leg.legId] ?? []}
                    basePrice={trip.price}
                    busy={busy}
                    onToggle={(n) =>
                      void toggleIn(
                        legSeats[leg.legId] ?? [],
                        (l) => setLegSeats((prev) => ({ ...prev, [leg.legId]: l })),
                        n,
                        trip.id,
                        { fromIndex: leg.fromIndex, toIndex: leg.toIndex }
                      )
                    }
                  />
                ) : (
                  <p className="text-sm text-ink-soft">{s.loading}</p>
                )}
              </section>
            ))}
          </>
        ) : null}

        {/* Way back */}
        {roundTrip ? (
          <section className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-200/70 sm:p-5">
            <h2 className="font-semibold text-navy">
              {fmt(s.returnTitle, { from: cityLabel(trip.to, lang), to: cityLabel(trip.from, lang) })}
            </h2>
            <label className="mt-3 block max-w-xs text-sm">
              <span className="mb-1 block font-medium text-ink-muted">{s.returnDate}</span>
              <input
                type="date"
                min={props.today}
                value={retDate}
                onChange={(e) => setRetDate(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-base text-navy focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </label>
            {retDate && returnTrips ? (
              returnTrips.length === 0 ? (
                <p className="mt-3 text-sm text-ink-soft">{s.noReturnTrips}</p>
              ) : (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {returnTrips.map((option) => {
                    const on = returnTripId === option.id;
                    return (
                      <li key={option.id}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={async () => {
                            setReturnTripId(option.id);
                            setReturnSeats([]);
                            setReturnLayout((await fetchLayout(option.id)).layout);
                          }}
                          className={`w-full rounded-xl border-2 px-3 py-2.5 text-left text-sm transition ${
                            on ? "border-brand-600 bg-brand-50" : "border-slate-200 hover:border-brand-300"
                          }`}
                        >
                          <span className="block font-semibold text-navy">
                            {shortDate(option.departureTime.slice(0, 10), lang)} · {option.departureTime.slice(11, 16)}
                          </span>
                          <span className="block text-ink-soft">
                            {option.carrier} · {money(option.price, lang)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : null}
            {returnTripId && returnLayout?.hasAssignedSeats ? (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-ink-muted">
                  {s.returnSeats}: {returnSeats.length} / {count}
                </p>
                <SeatMapView
                  layout={returnLayout}
                  selected={returnSeats}
                  basePrice={returnOption?.price ?? 0}
                  busy={busy}
                  onToggle={(n) => void toggleIn(returnSeats, setReturnSeats, n, returnTripId, null)}
                />
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      {/* Summary */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-200/70">
          <ul className="space-y-2 text-sm">
            {Array.from({ length: count }, (_, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">
                  {fmt(t.checkout.passengerN, { n: i + 1 })}
                  {seats[i] != null ? ` · ${fmt(t.checkout.seatN, { n: seats[i] })}` : ""}
                </span>
                <span className="font-semibold tabular-nums text-navy">
                  {money(seats[i] != null ? mainPrice(seats[i]) : trip.price, lang)}
                </span>
              </li>
            ))}
            {roundTrip && returnOption ? (
              <li className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                <span className="text-ink-muted">
                  {t.checkout.returnFare} × {count}
                </span>
                <span className="font-semibold tabular-nums text-navy">{money(returnOption.price * count, lang)}</span>
              </li>
            ) : null}
          </ul>
          <div className="mt-4 flex items-end justify-between border-t border-slate-200 pt-4">
            <span className="font-semibold text-navy">{s.total}</span>
            <span className="text-2xl font-bold tabular-nums text-navy">{money(total, lang)}</span>
          </div>
          <p className="mt-1 text-xs text-ink-soft">{s.priceNote}</p>
          <p role="alert" aria-live="polite" className={`text-sm font-medium text-rose-700 ${error ? "mt-3" : "sr-only"}`}>
            {error ?? ""}
          </p>
          <button type="button" onClick={proceed} className={`btn-primary mt-4 w-full ${canContinue ? "" : "opacity-80"}`}>
            {s.continue}
            <Icon name="arrowRight" className="h-4 w-4" />
          </button>
          {!canContinue && needMain > 0 ? (
            <p className="mt-2 text-center text-xs text-ink-soft">{plural(lang, needMain, s.needSeats)}</p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
