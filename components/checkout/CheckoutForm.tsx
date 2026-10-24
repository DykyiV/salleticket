"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Icon from "@/components/site/Icon";
import HoldTimer from "@/components/checkout/HoldTimer";
import { fmt, plural, useI18n } from "@/lib/i18n/client";
import { money } from "@/lib/i18n/format";
import { cityLabel } from "@/lib/trips/cities";
import { computePrice, type AgeCategoryId } from "@/lib/pricing";
import { ageCategoryFor, birthDateProblem, parseBirthDate } from "@/lib/age";
import { telHref } from "@/lib/siteContacts";

export type CheckoutTrip = {
  carrierId: string;
  tripId: string;
  from: string;
  to: string;
  date: string | null;
  departure: string;
  arrival: string;
  carrier: string;
  price: number;
  /** Adult fare per passenger (seat surcharge included), display only. */
  fares: number[];
  returnPrice: number;
  returnLabel: string | null;
  luggagePieces: number;
  tripKind: string;
  returnTripId: string | null;
  returnDate: string | null;
  seats: number[];
  returnSeats: number[];
  legs: {
    legId: string;
    assignmentId?: string;
    fromStopIndex: number;
    toStopIndex: number;
    fromCity?: string;
    toCity?: string;
    seats: number[];
  }[];
};

type Promo = { code: string; type?: "PERCENT" | "FIXED"; percent: number; amount?: number | null; label: string | null };
type PromoState = { status: "empty" } | { status: "checking" } | { status: "valid"; promo: Promo } | { status: "invalid"; message: string };
type Passenger = { firstName: string; lastName: string; birthDate: string };
type Method = "CASH_ON_BUS" | "ONLINE";

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function CheckoutForm({
  trip,
  user,
  online,
  serviceFee,
  supportPhone,
  backHref,
}: {
  trip: CheckoutTrip;
  user: { email: string } | null;
  online: { enabled: boolean; discountPercent: number };
  serviceFee: number;
  supportPhone: string | null;
  backHref: string;
}) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const c = t.checkout;
  const count = Math.max(1, trip.fares.length);

  const [passengers, setPassengers] = useState<Passenger[]>(() =>
    Array.from({ length: count }, () => ({ firstName: "", lastName: "", birthDate: "" }))
  );
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [accountExists, setAccountExists] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<PromoState>({ status: "empty" });
  const [method, setMethod] = useState<Method>("CASH_ON_BUS");
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<{ message: string; seat: boolean } | null>(null);

  const travelDate = useMemo(() => new Date(`${trip.date ?? new Date().toISOString().slice(0, 10)}T12:00:00Z`), [trip.date]);

  const ages: (AgeCategoryId | null)[] = passengers.map((p) => {
    const d = parseBirthDate(p.birthDate);
    return d && !birthDateProblem(d) ? ageCategoryFor(d, travelDate) : null;
  });

  const promoObj =
    promo.status === "valid"
      ? ({
          id: promo.promo.code,
          code: promo.promo.code,
          type: promo.promo.type ?? "PERCENT",
          percent: promo.promo.percent,
          amount: promo.promo.amount ?? null,
          label: promo.promo.label,
          isActive: true,
          startsAt: null,
          endsAt: null,
          usageLimit: null,
          usedCount: 0,
          userId: null,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        } as const)
      : null;

  const roundTrip = trip.tripKind === "ROUND_TRIP" && trip.returnTripId != null;
  const lines = passengers.map((_, i) => {
    const base = round2((trip.fares[i] ?? trip.price) + (roundTrip ? trip.returnPrice : 0));
    const priced = computePrice(base, ages[i] ?? "ADULT", promoObj, serviceFee);
    return { base, ...priced };
  });
  const discounts = round2(lines.reduce((s, l) => s + l.ageDiscount + l.promoDiscount, 0));
  const fees = round2(serviceFee * count);
  const fareTotal = round2(lines.reduce((s, l) => s + l.finalPrice, 0));
  const onlineSaving =
    method === "ONLINE" && online.enabled && online.discountPercent > 0 ? round2((fareTotal * Math.min(100, online.discountPercent)) / 100) : 0;
  const total = round2(fareTotal - onlineSaving + fees);

  const clearErr = (key: string) => {
    if (!(key in errors)) return;
    const next = { ...errors };
    delete next[key];
    setErrors(next);
    // All fixed → drop the «check the highlighted fields» banner too.
    if (!Object.keys(next).length) setSubmitError((se) => (se?.message === c.errorFix ? null : se));
  };

  const setP = (i: number, key: keyof Passenger, v: string) => {
    setPassengers((prev) => prev.map((p, j) => (j === i ? { ...p, [key]: v } : p)));
    clearErr(`p${i}-${key}`);
  };

  // Promo check (debounced).
  useEffect(() => {
    const code = promoInput.trim();
    if (!code) return;
    const ac = new AbortController();
    const timer = window.setTimeout(async () => {
      setPromo({ status: "checking" });
      try {
        const res = await fetch(`/api/promo/check?code=${encodeURIComponent(code)}`, { signal: ac.signal });
        const data = (await res.json()) as { ok: true; promo: Promo } | { ok: false; message: string };
        setPromo(data.ok ? { status: "valid", promo: data.promo } : { status: "invalid", message: data.message });
      } catch {
        // aborted
      }
    }, 400);
    return () => {
      ac.abort();
      window.clearTimeout(timer);
    };
  }, [promoInput]);

  const validate = () => {
    const next: Record<string, string> = {};
    passengers.forEach((p, i) => {
      if (!p.firstName.trim()) next[`p${i}-firstName`] = c.errorRequired;
      if (!p.lastName.trim()) next[`p${i}-lastName`] = c.errorRequired;
      const d = parseBirthDate(p.birthDate);
      if (!d) next[`p${i}-birthDate`] = c.errorBirth;
      else {
        const problem = birthDateProblem(d);
        if (problem) next[`p${i}-birthDate`] = problem;
      }
    });
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = c.errorEmail;
    if (phone.replace(/\D/g, "").length < 7) next.phone = c.errorPhone;
    if (accountExists && !user && !password) next.password = c.errorRequired;
    if (!agree) next.agree = c.errorAgree;
    if (promo.status === "invalid") next.promo = promo.message;
    setErrors(next);
    if (Object.keys(next).length) {
      const first = document.querySelector<HTMLElement>(`[data-field="${Object.keys(next)[0]}"]`);
      first?.focus();
    }
    return Object.keys(next).length === 0;
  };

  /** Signs the buyer in (new e-mail → new account; known e-mail → password). */
  const ensureAccount = async (): Promise<"ok" | "stop"> => {
    if (user) return "ok";
    const res = await fetch("/api/auth/guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password: accountExists ? password : undefined }),
    });
    const data = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
    if (res.ok) return "ok";
    if (res.status === 409) {
      setAccountExists(true);
      setErrors((e) => ({ ...e, password: c.accountExists }));
      window.setTimeout(() => document.querySelector<HTMLElement>('[data-field="password"]')?.focus(), 50);
      return "stop";
    }
    if (res.status === 401) {
      setErrors((e) => ({ ...e, password: data.error ?? c.errorGeneric }));
      return "stop";
    }
    setSubmitError({ message: data.error ?? c.errorGeneric, seat: false });
    return "stop";
  };

  const submit = async () => {
    setSubmitError(null);
    if (!validate()) {
      setSubmitError({ message: c.errorFix, seat: false });
      return;
    }
    setSubmitting(true);
    let leaving = false;
    try {
      if ((await ensureAccount()) === "stop") return;
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: trip.tripId,
          carrierId: trip.carrierId,
          tripKind: trip.tripKind,
          paymentMethod: method,
          returnTripId: roundTrip ? trip.returnTripId : undefined,
          contact: { phone: phone.trim(), email: email.trim() },
          passengers: passengers.map((p, i) => ({
            firstName: p.firstName.trim(),
            lastName: p.lastName.trim(),
            birthDate: p.birthDate,
            ageCategory: ages[i] ?? "ADULT",
            promoCode: promo.status === "valid" ? promo.promo.code : undefined,
            seatNumber: trip.seats[i] ?? null,
            returnSeatNumber: roundTrip ? (trip.returnSeats[i] ?? null) : null,
            legSeats: trip.legs.length ? trip.legs.map((leg) => leg.seats[i] ?? null) : undefined,
          })),
          legSegments: trip.legs.length
            ? trip.legs.map((leg) => ({
                legId: leg.legId,
                assignmentId: leg.assignmentId,
                fromStopIndex: leg.fromStopIndex,
                toStopIndex: leg.toStopIndex,
                fromCity: leg.fromCity,
                toCity: leg.toCity,
              }))
            : undefined,
          tripSnapshot: {
            carrier: trip.carrier,
            from: trip.from,
            to: trip.to,
            departure: trip.departure,
            arrival: trip.arrival,
            price: trip.price,
            currency: "EUR",
            date: trip.date ?? undefined,
          },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        booking?: { passengers?: { reference: string }[]; totalPaid: number; payment?: { payUrl?: string } };
      };
      if (!res.ok || !data.booking) {
        setSubmitError({ message: data.error ?? c.errorGeneric, seat: res.status === 409 });
        router.refresh();
        return;
      }
      if (method === "ONLINE" && data.booking.payment?.payUrl) {
        leaving = true;
        router.push(data.booking.payment.payUrl);
        return;
      }
      // The e-ticket page is step 5: QR, PDF, e-mail and «My tickets».
      const first = data.booking.passengers?.[0]?.reference;
      if (first) {
        leaving = true;
        router.push(`/tickets/${encodeURIComponent(first)}?new=1`);
        return;
      }
      setSubmitError({ message: c.errorGeneric, seat: false });
    } catch {
      setSubmitError({ message: c.errorGeneric, seat: false });
    } finally {
      if (!leaving) setSubmitting(false);
    }
  };

  const err = (key: string) =>
    errors[key] ? (
      <p id={`${key}-error`} className="mt-1 text-sm text-rose-700">
        {errors[key]}
      </p>
    ) : null;
  const inputCls = (key: string) =>
    `h-12 w-full rounded-xl border bg-white px-3 text-base text-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
      errors[key] ? "border-rose-400 focus:ring-rose-200" : "border-slate-200 focus:border-brand-500 focus:ring-brand-500/20"
    }`;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="grid gap-6 lg:grid-cols-[1fr_22rem]"
    >
      <div className="min-w-0 space-y-5">
        <HoldTimer />

        {/* Passengers */}
        {passengers.map((p, i) => (
          <Card key={i} title={`${fmt(c.passengerN, { n: i + 1 })}${trip.seats[i] != null ? ` · ${fmt(c.seatN, { n: trip.seats[i] })}` : ""}`} icon="user"
            aside={ages[i] ? <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">{c.ageCategory[ages[i]!]}</span> : null}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={c.firstName} id={`p${i}-firstName`} error={err(`p${i}-firstName`)}>
                <input
                  id={`p${i}-firstName`}
                  data-field={`p${i}-firstName`}
                  autoComplete={i === 0 ? "given-name" : "off"}
                  value={p.firstName}
                  onChange={(e) => setP(i, "firstName", e.target.value)}
                  aria-invalid={Boolean(errors[`p${i}-firstName`])}
                  aria-describedby={errors[`p${i}-firstName`] ? `p${i}-firstName-error` : undefined}
                  className={inputCls(`p${i}-firstName`)}
                />
              </Field>
              <Field label={c.lastName} id={`p${i}-lastName`} error={err(`p${i}-lastName`)}>
                <input
                  id={`p${i}-lastName`}
                  data-field={`p${i}-lastName`}
                  autoComplete={i === 0 ? "family-name" : "off"}
                  value={p.lastName}
                  onChange={(e) => setP(i, "lastName", e.target.value)}
                  aria-invalid={Boolean(errors[`p${i}-lastName`])}
                  className={inputCls(`p${i}-lastName`)}
                />
              </Field>
              <Field label={c.birthDate} id={`p${i}-birthDate`} error={err(`p${i}-birthDate`)}>
                <input
                  id={`p${i}-birthDate`}
                  data-field={`p${i}-birthDate`}
                  type="date"
                  autoComplete={i === 0 ? "bday" : "off"}
                  max={new Date().toISOString().slice(0, 10)}
                  value={p.birthDate}
                  onChange={(e) => setP(i, "birthDate", e.target.value)}
                  aria-invalid={Boolean(errors[`p${i}-birthDate`])}
                  className={inputCls(`p${i}-birthDate`)}
                />
              </Field>
              <p className="self-end pb-3 text-xs text-ink-soft sm:col-span-1">{c.nameHint}</p>
            </div>
          </Card>
        ))}

        {/* Contact + account */}
        <Card title={c.contact} icon="mail">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={c.email} id="email" hint={c.emailHint} error={err("email")}>
              <input
                id="email"
                data-field="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                readOnly={Boolean(user)}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setAccountExists(false);
                  setPassword("");
                  clearErr("email");
                  clearErr("password");
                }}
                className={inputCls("email")}
              />
            </Field>
            <Field label={c.phone} id="phone" hint={c.phoneHint} error={err("phone")}>
              <input
                id="phone"
                data-field="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="+380 / +34 …"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  clearErr("phone");
                }}
                className={inputCls("phone")}
              />
            </Field>
          </div>
          {user ? (
            <p className="mt-3 text-sm text-ink-soft">{fmt(c.signedInAs, { email: user.email })}</p>
          ) : accountExists ? (
            <div className="mt-3 rounded-xl bg-warn-50 p-3 ring-1 ring-warn-100">
              <Field label={c.password} id="password" hint={c.accountExists} error={err("password")}>
                <input
                  id="password"
                  data-field="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearErr("password");
                  }}
                  className={inputCls("password")}
                />
              </Field>
              <p className="mt-2 text-xs text-ink-soft">
                {c.forgot}
                {supportPhone ? (
                  <>
                    {" "}
                    <a href={telHref(supportPhone)} className="font-semibold text-brand-700">
                      {supportPhone}
                    </a>
                  </>
                ) : null}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-soft">{c.accountNew}</p>
          )}
        </Card>

        {/* Baggage (information only) */}
        <Card title={c.baggage} icon="luggage">
          <p className="text-sm text-ink">{fmt(c.baggageIncluded, { bags: plural(lang, Math.max(1, trip.luggagePieces), c.bags) })}</p>
          <p className="mt-2 text-sm text-ink-muted">
            {c.baggageExtra}
            {supportPhone ? (
              <>
                {" "}
                <a href={telHref(supportPhone)} className="font-semibold text-brand-700">
                  {fmt(c.baggageCall, { phone: supportPhone })}
                </a>
              </>
            ) : null}
          </p>
          <Link href="/baggage" target="_blank" className="mt-2 inline-block text-sm font-medium text-brand-700 underline">
            {c.baggageRules}
          </Link>
        </Card>

        {/* Payment */}
        <Card title={c.payment} icon="card">
          <div role="radiogroup" aria-label={c.payment} className="space-y-2">
            <PayOption checked={method === "CASH_ON_BUS"} onSelect={() => setMethod("CASH_ON_BUS")} title={c.payOnBus} hint={c.payOnBusHint} icon="bus" />
            {[
              { title: c.card, icon: "card" as const },
              { title: c.applePay, icon: "phone" as const },
              { title: c.googlePay, icon: "phone" as const },
            ].map((m) => (
              <PayOption
                key={m.title}
                checked={online.enabled && method === "ONLINE" && m.title === c.card}
                onSelect={() => setMethod("ONLINE")}
                disabled={!online.enabled || m.title !== c.card}
                title={m.title}
                hint={online.enabled && online.discountPercent > 0 ? fmt(c.onlineDiscount, { n: online.discountPercent }) : undefined}
                badge={!online.enabled || m.title !== c.card ? c.soon : undefined}
                icon={m.icon}
              />
            ))}
            <PayOption checked={false} onSelect={() => {}} disabled title={c.local} badge={c.soon} icon="globe" />
          </div>
        </Card>
      </div>

      {/* Summary */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-200/70">
          <h2 className="text-lg font-semibold text-navy">{c.summary}</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {cityLabel(trip.from, lang)} → {cityLabel(trip.to, lang)} · {trip.departure} – {trip.arrival}
            {roundTrip && trip.returnLabel ? ` · ${c.returnFare}: ${trip.returnLabel}` : ""}
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {lines.map((l, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="text-ink-muted">
                  {c.fare} {i + 1}
                  {ages[i] && ages[i] !== "ADULT" ? ` · ${c.ageCategory[ages[i]!]}` : ""}
                </span>
                <span className="tabular-nums text-navy">{money(l.basePrice, lang)}</span>
              </li>
            ))}
            <li className="flex justify-between gap-2">
              <span className="text-ink-muted">{c.baggageLine}</span>
              <span className="text-ok-700">{c.included}</span>
            </li>
            {discounts > 0 ? (
              <li className="flex justify-between gap-2">
                <span className="text-ink-muted">{c.discount}</span>
                <span className="tabular-nums text-ok-700">−{money(discounts, lang)}</span>
              </li>
            ) : null}
            {onlineSaving > 0 ? (
              <li className="flex justify-between gap-2">
                <span className="text-ink-muted">{fmt(c.onlineDiscount, { n: online.discountPercent })}</span>
                <span className="tabular-nums text-ok-700">−{money(onlineSaving, lang)}</span>
              </li>
            ) : null}
            {fees > 0 ? (
              <li className="flex justify-between gap-2">
                <span className="text-ink-muted">
                  {c.fee} × {count}
                </span>
                <span className="tabular-nums text-navy">{money(fees, lang)}</span>
              </li>
            ) : null}
          </ul>

          {/* Promo */}
          <div className="mt-4 border-t border-slate-100 pt-4">
            <label htmlFor="promo" className="mb-1 block text-sm font-medium text-ink-muted">
              {c.promo}
            </label>
            <input
              id="promo"
              data-field="promo"
              value={promoInput}
              placeholder={c.promoPlaceholder}
              onChange={(e) => {
                setPromoInput(e.target.value);
                clearErr("promo");
                if (!e.target.value.trim()) setPromo({ status: "empty" });
              }}
              className={`${inputCls("promo")} h-11 uppercase`}
            />
            <p className="mt-1 text-xs" aria-live="polite">
              {promo.status === "checking" ? (
                <span className="text-ink-soft">{c.promoChecking}</span>
              ) : promo.status === "valid" ? (
                <span className="font-medium text-ok-700">{fmt(c.promoOk, { code: promo.promo.code })}</span>
              ) : promo.status === "invalid" ? (
                <span className="text-rose-700">{promo.message}</span>
              ) : null}
            </p>
          </div>

          <div className="mt-4 flex items-end justify-between border-t border-slate-200 pt-4">
            <span className="font-semibold text-navy">{c.total}</span>
            <span className="text-2xl font-bold tabular-nums text-navy">{money(total, lang)}</span>
          </div>

          <label className="mt-4 flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              data-field="agree"
              checked={agree}
              onChange={(e) => {
                setAgree(e.target.checked);
                clearErr("agree");
              }}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span>
              {c.agree} ·{" "}
              <Link href="/rules" target="_blank" className="text-brand-700 underline">
                {c.terms}
              </Link>{" "}
              ·{" "}
              <Link href="/rules#privacy" target="_blank" className="text-brand-700 underline">
                {c.privacy}
              </Link>
            </span>
          </label>
          {err("agree")}

          {submitError ? (
            <div role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-100">
              <p>{submitError.message}</p>
              {submitError.seat ? (
                <Link href={backHref} className="mt-2 inline-block font-semibold underline">
                  {c.pickOther}
                </Link>
              ) : null}
            </div>
          ) : null}

          <button type="submit" disabled={submitting} className="btn-primary mt-4 w-full">
            {submitting
              ? c.submitting
              : method === "ONLINE"
                ? fmt(c.submitOnline, { total: money(total, lang) })
                : c.submitCash}
          </button>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-ink-soft">
            <Icon name="check" className="h-3.5 w-3.5 text-ok" />
            {c.secure}
          </p>
        </div>
      </aside>
    </form>
  );
}

function Card({ title, icon, aside, children }: { title: string; icon: "user" | "mail" | "luggage" | "card"; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-200/70 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-navy">
          <Icon name={icon} className="h-5 w-5 text-brand-600" />
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Field({ label, id, hint, error, children }: { label: string; id: string; hint?: string; error?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink-muted">
        {label}
      </label>
      {children}
      {error ?? (hint ? <p className="mt-1 text-xs text-ink-soft">{hint}</p> : null)}
    </div>
  );
}

function PayOption({
  checked,
  onSelect,
  disabled,
  title,
  hint,
  badge,
  icon,
}: {
  checked: boolean;
  onSelect: () => void;
  disabled?: boolean;
  title: string;
  hint?: string;
  badge?: string;
  icon: "bus" | "card" | "phone" | "globe";
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${
        checked ? "border-brand-600 bg-brand-50" : disabled ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-70" : "border-slate-200 hover:border-brand-300"
      }`}
    >
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${checked ? "border-brand-600" : "border-slate-300"}`}>
        {checked ? <span className="h-2.5 w-2.5 rounded-full bg-brand-600" /> : null}
      </span>
      <Icon name={icon} className="h-5 w-5 shrink-0 text-ink-soft" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-navy">{title}</span>
        {hint ? <span className="block text-sm text-ink-soft">{hint}</span> : null}
      </span>
      {badge ? <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">{badge}</span> : null}
    </button>
  );
}
