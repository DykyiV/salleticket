"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import BookingSeatPicker, {
  type BookingSeatValue,
} from "@/components/booking/BookingSeatPicker";
import {
  AGE_CATEGORIES,
  computePrice,
  type AgeCategoryId,
} from "@/lib/pricing";
import { parseTripKind, type TripKindId } from "@/lib/tickets/kinds";
import { TRIP_KIND_LABEL } from "@/lib/tickets/labels";

type PromoPreview = {
  code: string;
  type?: "PERCENT" | "FIXED";
  percent: number;
  amount?: number | null;
  label: string | null;
};

type PromoState =
  | { status: "empty" }
  | { status: "checking" }
  | { status: "valid"; promo: PromoPreview }
  | { status: "invalid"; message: string };

type TripSummary = {
  carrier: string;
  carrierId?: string;
  tripId?: string;
  from: string;
  to: string;
  date?: string;
  departure: string;
  arrival: string;
  price: number;
  total: number;
};

type CurrentUser = {
  id: string;
  email: string;
  role: string;
};

type Props = {
  tripSummary: TripSummary;
  currentUser?: CurrentUser | null;
  tripKind?: TripKindId;
  returnDate?: string;
};

type BookingConfirmation = {
  reference: string;
  carrierReference?: string;
  totalPaid: number;
  status: string;
  finalPrice: number;
  paymentMethod: "CASH_ON_BUS" | "ONLINE";
  payUrl?: string;
};

type Values = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  ageCategory: AgeCategoryId;
  promoCode: string;
  agree: boolean;
};

type Errors = Partial<Record<keyof Values, string>>;

export default function BookingForm({
  tripSummary,
  currentUser,
  tripKind: tripKindProp,
  returnDate,
}: Props) {
  const router = useRouter();
  const isAuthed = Boolean(currentUser);
  const tripKind = parseTripKind(tripKindProp);

  const [seatValue, setSeatValue] = useState<BookingSeatValue>({
    seatNumber: null,
    returnTripId: null,
    returnSeatNumber: null,
    returnPrice: 0,
    outboundAssignsSeats: true,
    returnAssignsSeats: true,
  });
  const [sessionId] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `sess-${Math.random().toString(36).slice(2)}${Date.now()}`
  );
  const [salesSettings, setSalesSettings] = useState<{
    onlineDiscountPercent: number;
    paymentDeadlineHours: number;
  }>({ onlineDiscountPercent: 0, paymentDeadlineHours: 24 });

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((data) =>
        setSalesSettings({
          onlineDiscountPercent: Number(data.onlineDiscountPercent) || 0,
          paymentDeadlineHours: Number(data.paymentDeadlineHours) || 24,
        })
      )
      .catch(() => {});
  }, []);

  const [loginHref, setLoginHref] = useState("/login");
  useEffect(() => {
    const next = window.location.pathname + window.location.search;
    setLoginHref(`/login?next=${encodeURIComponent(next)}`);
  }, []);
  const [values, setValues] = useState<Values>({
    firstName: "",
    lastName: "",
    phone: "",
    email: currentUser?.email ?? "",
    ageCategory: "ADULT",
    promoCode: "",
    agree: false,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(
    null
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [promoState, setPromoState] = useState<PromoState>({ status: "empty" });

  // Debounced server-side promo check. Hits /api/promo/check which runs the
  // same rules as POST /api/booking (isActive, date window, usage limit, and
  // per-user binding if set) without incrementing usedCount.
  useEffect(() => {
    const raw = values.promoCode.trim();
    if (!raw) {
      setPromoState({ status: "empty" });
      return;
    }
    setPromoState({ status: "checking" });
    const ac = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/promo/check?code=${encodeURIComponent(raw)}`,
          { signal: ac.signal }
        );
        const data = (await res.json()) as
          | { ok: true; promo: PromoPreview }
          | { ok: false; reason: string; message: string };
        if (data.ok) {
          setPromoState({ status: "valid", promo: data.promo });
        } else {
          setPromoState({ status: "invalid", message: data.message });
        }
      } catch {
        // aborted or network error — leave the prior state alone
      }
    }, 250);
    return () => {
      ac.abort();
      window.clearTimeout(timer);
    };
  }, [values.promoCode]);

  const activePromo = promoState.status === "valid" ? promoState.promo : null;

  const price = useMemo(
    () =>
      computePrice(
        tripSummary.price + (tripKind === "ROUND_TRIP" ? seatValue.returnPrice : 0),
        values.ageCategory,
        activePromo
          ? {
              // Shape-compatible with the shared `computePrice(Promo?)`.
              // `type`, `percent` and `amount` drive the math; the rest of
              // the Prisma row columns are placeholders so the UI stays in
              // sync with `promoDiscountAmount` on the server.
              id: activePromo.code,
              code: activePromo.code,
              type: activePromo.type ?? "PERCENT",
              percent: activePromo.percent,
              amount: activePromo.amount ?? null,
              label: activePromo.label,
              isActive: true,
              startsAt: null,
              endsAt: null,
              usageLimit: null,
              usedCount: 0,
              userId: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          : null
      ),
    [tripSummary.price, values.ageCategory, activePromo, tripKind, seatValue.returnPrice]
  );

  const onlineTotal = useMemo(() => {
    const pct = Math.min(100, Math.max(0, salesSettings.onlineDiscountPercent));
    const discounted =
      Math.round(price.finalPrice * (1 - pct / 100) * 100) / 100;
    return Math.round((discounted + price.serviceFee) * 100) / 100;
  }, [price.finalPrice, price.serviceFee, salesSettings.onlineDiscountPercent]);

  const setField = <K extends keyof Values>(field: K, value: Values[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (!values.firstName.trim()) {
      next.firstName = "First name is required.";
    }
    if (!values.lastName.trim()) {
      next.lastName = "Last name is required.";
    }
    const phoneDigits = values.phone.replace(/\D/g, "");
    if (phoneDigits.length < 7) {
      next.phone = "Please enter a valid phone number.";
    }
    if (values.email && !/^\S+@\S+\.\S+$/.test(values.email)) {
      next.email = "Please enter a valid email address.";
    }
    if (!AGE_CATEGORIES.some((c) => c.id === values.ageCategory)) {
      next.ageCategory = "Please choose an age category.";
    }
    if (promoState.status === "invalid") {
      next.promoCode = promoState.message;
    }
    if (promoState.status === "checking") {
      // Don't submit while the server is still validating the code
      next.promoCode = "Checking promo code…";
    }
    if (!values.agree) {
      next.agree = "Please accept the terms to continue.";
    }
    return next;
  };

  const handleSubmit = async (
    e: FormEvent<HTMLFormElement> | null,
    paymentMethod: "CASH_ON_BUS" | "ONLINE"
  ) => {
    e?.preventDefault();
    const found = validate();
    setErrors(found);
    setSubmitError(null);
    if (Object.keys(found).length > 0) return;
    if (seatValue.outboundAssignsSeats && seatValue.seatNumber == null) {
      setSubmitError("Оберіть місце в салоні");
      return;
    }
    if (tripKind === "ROUND_TRIP" && !seatValue.returnTripId) {
      setSubmitError("Оберіть зворотній рейс і місце");
      return;
    }
    if (
      tripKind === "ROUND_TRIP" &&
      seatValue.returnAssignsSeats &&
      seatValue.returnSeatNumber == null
    ) {
      setSubmitError("Оберіть місце на зворотній рейс");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: tripSummary.tripId ?? "unknown",
          carrierId: tripSummary.carrierId ?? "mock",
          promoCode: activePromo?.code ?? undefined,
          passenger: {
            firstName: values.firstName.trim(),
            lastName: values.lastName.trim(),
            ageCategory: values.ageCategory,
            phone: values.phone.trim(),
            email: values.email.trim() || undefined,
          },
          tripSnapshot: {
            carrier: tripSummary.carrier,
            from: tripSummary.from,
            to: tripSummary.to,
            departure: tripSummary.departure,
            arrival: tripSummary.arrival,
            price: tripSummary.price,
            currency: "EUR",
            date: tripSummary.date,
          },
          tripKind,
          seatNumber: seatValue.seatNumber,
          returnTripId: seatValue.returnTripId ?? undefined,
          returnSeatNumber: seatValue.returnSeatNumber,
          paymentMethod,
          holdSessionId: sessionId,
        }),
      });

      if (res.status === 401) {
        const next =
          typeof window !== "undefined"
            ? window.location.pathname + window.location.search
            : "/booking";
        router.push(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Booking failed");
      }

      if (paymentMethod === "ONLINE" && data.booking.payment?.payUrl) {
        router.push(data.booking.payment.payUrl as string);
        return;
      }

      setConfirmation({
        reference: data.booking.reference,
        carrierReference: data.carrierReference,
        totalPaid: data.booking.totalPaid,
        status: data.booking.status,
        finalPrice: data.booking.finalPrice ?? data.booking.basePrice ?? 0,
        paymentMethod,
        payUrl: data.booking.payment?.payUrl,
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmation) {
    const fullName = `${values.firstName} ${values.lastName}`.trim();
    const ageLabel = AGE_CATEGORIES.find((c) => c.id === values.ageCategory)?.label;
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200">
            <CheckIcon className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Booking confirmed
            </h2>
            <p className="text-sm text-slate-500">
              We&apos;ve reserved your seat. A mock confirmation has been generated below.
            </p>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <SummaryRow label="Reference" value={confirmation.reference} mono />
          {confirmation.carrierReference ? (
            <SummaryRow
              label="Carrier PNR"
              value={confirmation.carrierReference}
              mono
            />
          ) : null}
          <SummaryRow label="Passenger" value={fullName} />
          {ageLabel ? <SummaryRow label="Age category" value={ageLabel} /> : null}
          <SummaryRow label="Phone" value={values.phone} />
          {values.email ? <SummaryRow label="Email" value={values.email} /> : null}
          {activePromo ? (
            <SummaryRow label="Promo" value={activePromo.code} mono />
          ) : null}
          <SummaryRow
            label="Route"
            value={`${tripSummary.from} → ${tripSummary.to}`}
          />
          <SummaryRow label="Тип квитка" value={TRIP_KIND_LABEL[tripKind]} />
          {seatValue.outboundAssignsSeats && seatValue.seatNumber != null ? (
            <SummaryRow label="Місце" value={String(seatValue.seatNumber)} />
          ) : !seatValue.outboundAssignsSeats ? (
            <SummaryRow label="Місце" value="без місць" />
          ) : null}
          <SummaryRow
            label="When"
            value={`${tripSummary.departure} → ${tripSummary.arrival}`}
          />
          <SummaryRow label="Carrier" value={tripSummary.carrier} />
          <SummaryRow label="Status" value={confirmation.status} />
          <SummaryRow
            label="Оплата"
            value={
              confirmation.paymentMethod === "ONLINE"
                ? "Онлайн"
                : "В автобусі"
            }
          />
          <SummaryRow
            label="Ticket price"
            value={`€${confirmation.finalPrice.toFixed(2)}`}
          />
          <SummaryRow
            label="Total paid"
            value={`€${confirmation.totalPaid.toFixed(2)}`}
          />
        </dl>

        <p className="mt-4 text-xs text-slate-400">
          Demo only — no real payment or reservation was made.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <a
            href={`/cabinet/tickets/${confirmation.reference}`}
            className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Відкрити квиток
          </a>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
          >
            Book another trip
          </a>
          <a
            href="/results"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
          >
            Back to results
          </a>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      noValidate
      className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8"
    >
      <h2 className="text-lg font-semibold text-slate-900">Passenger details</h2>
      <p className="mt-1 text-sm text-slate-500">
        Please enter the primary passenger&apos;s information.
      </p>

      {isAuthed ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <UserIcon className="h-4 w-4 shrink-0" />
          <span className="min-w-0 truncate">
            Signed in as{" "}
            <span className="font-semibold">{currentUser!.email}</span>
          </span>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900">
          <span>
            Booking as a guest — sign in to save this ticket to your account.
          </span>
          <a
            href={loginHref}
            className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-brand-700"
          >
            Sign in
          </a>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="firstName"
          label="First name"
          placeholder="John"
          value={values.firstName}
          onChange={(e) => setField("firstName", e.target.value)}
          error={errors.firstName}
          autoComplete="given-name"
          required
        />

        <Field
          id="lastName"
          label="Last name"
          placeholder="Doe"
          value={values.lastName}
          onChange={(e) => setField("lastName", e.target.value)}
          error={errors.lastName}
          autoComplete="family-name"
          required
        />

        <Field
          id="phone"
          label="Phone"
          type="tel"
          placeholder="+380 99 123 45 67"
          value={values.phone}
          onChange={(e) => setField("phone", e.target.value)}
          error={errors.phone}
          autoComplete="tel"
          required
        />

        <Field
          id="email"
          label={isAuthed ? "Email (your account)" : "Email (optional)"}
          type="email"
          placeholder="you@example.com"
          value={values.email}
          onChange={(e) => setField("email", e.target.value)}
          error={errors.email}
          autoComplete="email"
          readOnly={isAuthed}
          hint={
            isAuthed
              ? "Linked to your account — sign out to use a different email."
              : undefined
          }
        />
      </div>

      <div className="mt-6">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Age category
          <span className="ml-1 text-rose-500">*</span>
        </span>
        <div
          role="radiogroup"
          aria-label="Age category"
          aria-required="true"
          aria-invalid={errors.ageCategory ? "true" : undefined}
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          {AGE_CATEGORIES.map((cat) => {
            const active = values.ageCategory === cat.id;
            return (
              <label
                key={cat.id}
                className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm transition focus-within:ring-2 focus-within:ring-brand-200 ${
                  active
                    ? "border-brand-400 bg-brand-50 text-brand-900"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-brand-200 hover:bg-white"
                }`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="ageCategory"
                    value={cat.id}
                    checked={active}
                    onChange={() => setField("ageCategory", cat.id)}
                    required
                    className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="font-medium">{cat.label}</span>
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    cat.discount > 0
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {cat.description}
                </span>
              </label>
            );
          })}
        </div>
        {errors.ageCategory ? (
          <p className="mt-2 text-xs text-rose-600">{errors.ageCategory}</p>
        ) : null}
      </div>

      <BookingSeatPicker
        tripId={tripSummary.tripId}
        from={tripSummary.from}
        to={tripSummary.to}
        tripKind={tripKind}
        returnDate={returnDate}
        sessionId={sessionId}
        onChange={setSeatValue}
      />

      <div className="mt-6">
        <label htmlFor="promoCode" className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Promo code <span className="font-normal text-slate-400">(optional)</span>
          </span>
          <div className="relative">
            <input
              id="promoCode"
              name="promoCode"
              type="text"
              value={values.promoCode}
              onChange={(e) =>
                setField("promoCode", e.target.value.toUpperCase())
              }
              placeholder="e.g. DISCOUNT10"
              aria-invalid={errors.promoCode ? "true" : undefined}
              className={`h-12 w-full rounded-xl border bg-slate-50 px-3 pr-28 text-sm uppercase tracking-wider text-slate-900 placeholder:text-slate-400 placeholder:normal-case transition focus:bg-white focus:outline-none focus:ring-2 ${
                promoState.status === "invalid"
                  ? "border-rose-300 focus:border-rose-400 focus:ring-rose-200"
                  : promoState.status === "valid"
                    ? "border-emerald-300 focus:border-emerald-400 focus:ring-emerald-200"
                    : "border-slate-200 focus:border-brand-400 focus:ring-brand-200"
              }`}
            />
            <span
              className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-[11px] font-semibold ${
                promoState.status === "valid"
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100"
                  : promoState.status === "invalid"
                    ? "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-100"
                    : promoState.status === "checking"
                      ? "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100"
                      : "bg-slate-100 text-slate-500"
              }`}
            >
              {promoState.status === "valid"
                ? promoState.promo.type === "FIXED"
                  ? `-€${(promoState.promo.amount ?? 0).toFixed(2)}`
                  : `-${Math.round(promoState.promo.percent * 100)}%`
                : promoState.status === "invalid"
                  ? "invalid"
                  : promoState.status === "checking"
                    ? "…"
                    : "—"}
            </span>
          </div>
        </label>
        {promoState.status === "valid" ? (
          <p className="mt-1 text-xs text-emerald-700">
            Applied
            {promoState.promo.label ? ` — ${promoState.promo.label}` : ""}
          </p>
        ) : promoState.status === "invalid" ? (
          <p className="mt-1 text-xs text-rose-600">{promoState.message}</p>
        ) : errors.promoCode ? (
          <p className="mt-1 text-xs text-rose-600">{errors.promoCode}</p>
        ) : (
          <p className="mt-1 text-xs text-slate-400">
            Have a code? Enter it here and we&apos;ll check it against the server.
          </p>
        )}
      </div>

      <PriceBreakdownPanel
        basePrice={price.basePrice}
        ageDiscount={price.ageDiscount}
        ageLabel={
          AGE_CATEGORIES.find((c) => c.id === values.ageCategory)?.label ?? ""
        }
        promoDiscount={price.promoDiscount}
        promoCode={activePromo?.code}
        serviceFee={price.serviceFee}
        finalPrice={price.finalPrice}
        total={price.total}
        onlineTotal={onlineTotal}
        onlineDiscountPercent={salesSettings.onlineDiscountPercent}
      />

      <label className="mt-6 flex items-start gap-2.5 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={values.agree}
          onChange={(e) => setField("agree", e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <span>
          I agree to the{" "}
          <a href="#" className="font-medium text-brand-700 hover:underline">
            terms of service
          </a>{" "}
          and{" "}
          <a href="#" className="font-medium text-brand-700 hover:underline">
            privacy policy
          </a>
          .
        </span>
      </label>
      {errors.agree ? (
        <p className="mt-1 text-xs text-rose-600">{errors.agree}</p>
      ) : null}

      {submitError ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {submitError}
        </div>
      ) : null}

      <div className="mt-8 space-y-3 border-t border-dashed border-slate-200 pt-6">
        <p className="text-xs text-slate-500">
          Оберіть спосіб завершення бронювання. Місце вже закріплене за вами.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => handleSubmit(null, "CASH_ON_BUS")}
            disabled={submitting}
            className="inline-flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-brand-300 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <>
                <span>Забронювати · оплата в автобусі</span>
                <span className="text-base font-bold tabular-nums">
                  €{price.total.toFixed(2)}
                </span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(null, "ONLINE")}
            disabled={submitting}
            className="inline-flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <>
                <span>
                  Оплатити зараз
                  {salesSettings.onlineDiscountPercent > 0 ? (
                    <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[11px]">
                      −{salesSettings.onlineDiscountPercent}%
                    </span>
                  ) : null}
                </span>
                <span className="text-base font-bold tabular-nums">
                  €{onlineTotal.toFixed(2)}
                  {onlineTotal < price.total ? (
                    <span className="ml-1.5 align-middle text-xs font-medium text-brand-100 line-through">
                      €{price.total.toFixed(2)}
                    </span>
                  ) : null}
                </span>
                <span className="text-[11px] font-normal text-brand-100">
                  на оплату {salesSettings.paymentDeadlineHours} год
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

function PriceBreakdownPanel({
  basePrice,
  ageDiscount,
  ageLabel,
  promoDiscount,
  promoCode,
  serviceFee,
  finalPrice,
  total,
  onlineTotal,
  onlineDiscountPercent,
}: {
  basePrice: number;
  ageDiscount: number;
  ageLabel: string;
  promoDiscount: number;
  promoCode?: string;
  serviceFee: number;
  finalPrice: number;
  total: number;
  onlineTotal: number;
  onlineDiscountPercent: number;
}) {
  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Price breakdown
      </p>
      <dl className="mt-2 space-y-1.5 text-sm">
        <div className="flex items-center justify-between text-slate-600">
          <dt>Base fare</dt>
          <dd className="tabular-nums">€{basePrice.toFixed(2)}</dd>
        </div>
        {ageDiscount > 0 ? (
          <div className="flex items-center justify-between text-emerald-700">
            <dt>Age discount ({ageLabel})</dt>
            <dd className="tabular-nums">−€{ageDiscount.toFixed(2)}</dd>
          </div>
        ) : null}
        {promoDiscount > 0 && promoCode ? (
          <div className="flex items-center justify-between text-emerald-700">
            <dt>
              Promo <span className="font-mono">{promoCode}</span>
            </dt>
            <dd className="tabular-nums">−€{promoDiscount.toFixed(2)}</dd>
          </div>
        ) : null}
        <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-1.5 text-slate-600">
          <dt>Ticket</dt>
          <dd className="tabular-nums font-medium text-slate-900">
            €{finalPrice.toFixed(2)}
          </dd>
        </div>
        <div className="flex items-center justify-between text-slate-600">
          <dt>Service fee</dt>
          <dd className="tabular-nums">€{serviceFee.toFixed(2)}</dd>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-2">
          <dt className="text-sm font-semibold text-slate-900">Total</dt>
          <dd className="text-xl font-extrabold tracking-tight text-slate-900 tabular-nums">
            €{total.toFixed(2)}
          </dd>
        </div>
        {onlineDiscountPercent > 0 ? (
          <div className="flex items-center justify-between text-emerald-700">
            <dt>Онлайн-оплата (−{onlineDiscountPercent}%)</dt>
            <dd className="tabular-nums font-semibold">
              €{onlineTotal.toFixed(2)}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  autoComplete?: string;
  required?: boolean;
  readOnly?: boolean;
  hint?: string;
};

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  autoComplete,
  required,
  readOnly,
  hint,
}: FieldProps) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
        {readOnly ? (
          <span className="ml-2 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-100">
            LOCKED
          </span>
        ) : null}
      </span>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        readOnly={readOnly}
        aria-invalid={error ? "true" : undefined}
        className={`h-12 w-full rounded-xl border px-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 ${
          readOnly
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-600"
            : "bg-slate-50 focus:bg-white"
        } ${
          error
            ? "border-rose-300 focus:border-rose-400 focus:ring-rose-200"
            : "border-slate-200 focus:border-brand-400 focus:ring-brand-200"
        }`}
      />
      {error ? (
        <span className="mt-1 block text-xs text-rose-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-slate-400">{hint}</span>
      ) : null}
    </label>
  );
}

function SummaryRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd
        className={`text-right font-medium text-slate-900 ${
          mono ? "font-mono tracking-wider" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className ?? ""}`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  );
}
