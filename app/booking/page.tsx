import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import SiteFooter from "@/components/site/SiteFooter";
import Icon from "@/components/site/Icon";
import StepIndicator from "@/components/checkout/StepIndicator";
import CheckoutForm, { type CheckoutTrip } from "@/components/checkout/CheckoutForm";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { money, shortDate } from "@/lib/i18n/format";
import { onlinePaymentsEnabled } from "@/lib/paymentMode";
import { priceForTrip } from "@/lib/pricing/grid";
import { getSiteSettings } from "@/lib/settings";
import { getSiteContacts } from "@/lib/siteContacts";
import { parseTripKind } from "@/lib/tickets/kinds";
import { seatPriceMultiplier } from "@/lib/tickets/inventory";
import { cityLabel } from "@/lib/trips/cities";
import { findSearchTrip, tripRefFromParams, tripRefParams } from "@/lib/trips/lookup";

export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;

function parseSeats(raw?: string): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => Number.parseInt(v, 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 999)
    .slice(0, 6);
}

type LegParam = {
  legId: string;
  assignmentId?: string;
  fromStopIndex: number;
  toStopIndex: number;
  fromCity?: string;
  toCity?: string;
  seats: number[];
};

function parseLegs(raw?: string): LegParam[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as LegParam[];
    return Array.isArray(parsed) ? parsed.filter((l) => l && typeof l.legId === "string").slice(0, 4) : [];
  } catch {
    return [];
  }
}

function count(v?: string): number {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: `${t.checkout.metaTitle} — Asol BUS` };
}

export default async function BookingPage(props: { searchParams: Promise<SP> }) {
  const sp = await props.searchParams;
  const [{ t, lang }, user, settings, contacts] = await Promise.all([
    getDict(),
    getCurrentUser(),
    getSiteSettings(),
    getSiteContacts(),
  ]);
  const ref = tripRefFromParams(sp);
  const trip = ref ? await findSearchTrip(ref).catch(() => null) : null;

  const seats = parseSeats(sp.seats);
  const passengers = Math.min(6, Math.max(1, count(sp.passengers) || seats.length || 1));
  const tripKind = parseTripKind(sp.tripKind);
  const returnTripId = tripKind === "ROUND_TRIP" ? sp.returnTripId : undefined;

  const backParams = ref ? tripRefParams(ref) : new URLSearchParams();
  for (const k of ["tripKind", "returnDate", "passengers", "adults", "children", "seniors"]) {
    if (sp[k]) backParams.set(k, sp[k]!);
  }
  const backHref = trip ? `/trip?${backParams}` : "/results";

  let checkoutTrip: CheckoutTrip | null = null;
  if (trip && ref) {
    // Display prices (the booking API recomputes everything on its own).
    const stored = trip.carrierId === "asol";
    const fares = await Promise.all(
      Array.from({ length: passengers }, async (_, i) => {
        const mult = stored && seats[i] != null ? await seatPriceMultiplier(prisma, trip.id, seats[i]).catch(() => 1) : 1;
        return Math.round(trip.price * mult * 100) / 100;
      })
    );
    let returnPrice = 0;
    let returnLabel: string | null = null;
    if (returnTripId) {
      const rt = await prisma.trip.findUnique({ where: { id: returnTripId } });
      if (rt) {
        returnPrice = (await priceForTrip(prisma, rt)).price;
        returnLabel = `${shortDate(rt.departureTime.toISOString().slice(0, 10), lang)} · ${rt.departureTime.toISOString().slice(11, 16)}`;
      }
    }
    checkoutTrip = {
      carrierId: trip.carrierId,
      tripId: trip.id,
      from: trip.from,
      to: trip.to,
      date: trip.departureAt?.slice(0, 10) ?? ref.date ?? null,
      departure: trip.departure,
      arrival: trip.arrival,
      carrier: trip.carrier,
      price: trip.price,
      fares,
      returnPrice,
      returnLabel,
      luggagePieces: trip.luggagePieces ?? 1,
      tripKind,
      returnTripId: returnTripId ?? null,
      returnDate: sp.returnDate ?? null,
      seats,
      returnSeats: parseSeats(sp.returnSeats),
      legs: parseLegs(sp.legs),
    };
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <section className="bg-navy">
        <div className="container-site py-5 sm:py-6">
          <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-blue-200 hover:text-white">
            <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
            {t.steps.seats}
          </Link>
          {trip ? (
            <div className="mt-3 text-white">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t.checkout.title}</h1>
              <p className="mt-1 text-sm text-blue-100/90">
                {cityLabel(trip.from, lang)} → {cityLabel(trip.to, lang)}
                {checkoutTrip?.date ? ` · ${shortDate(checkoutTrip.date, lang)}` : ""} · {trip.departure} – {trip.arrival} · {trip.carrier} ·{" "}
                {money(trip.price, lang)}
              </p>
            </div>
          ) : null}
          <div className="mt-5">
            <StepIndicator t={t} current={3} />
          </div>
        </div>
      </section>
      <main className="flex-1">
        <div className="container-site py-6 sm:py-8">
          {!checkoutTrip ? (
            <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-soft ring-1 ring-slate-200/70">
              <h2 className="text-lg font-semibold text-navy">{t.seat.notFound}</h2>
              <p className="mt-2 text-sm text-ink-muted">{t.seat.notFoundHint}</p>
              <Link href="/results" className="btn-primary mt-5 px-5 py-2.5 text-sm">
                {t.seat.back}
              </Link>
            </div>
          ) : (
            <CheckoutForm
              trip={checkoutTrip}
              user={user ? { email: user.email } : null}
              online={{ enabled: onlinePaymentsEnabled(), discountPercent: settings.onlineDiscountPercent }}
              serviceFee={settings.serviceFeePerPassenger}
              supportPhone={contacts.phoneUa || contacts.phoneEs || contacts.phoneDe || null}
              backHref={backHref}
            />
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
