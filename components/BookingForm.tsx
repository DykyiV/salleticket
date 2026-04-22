"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AGE_CATEGORIES,
  checkPromo,
  computePrice,
  promoBadge,
  type AgeCategoryId,
} from "@/lib/pricing";
import { PROMO_CODES } from "@/lib/promo";

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

type Props = {
  tripSummary: TripSummary;
};

type BookingConfirmation = {
  reference: string;
  carrierReference?: string;
  totalPaid: number;
  status: string;
  finalPrice: number;
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

export default function BookingForm({ tripSummary }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<Values>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
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

  const promoCheck = useMemo(() => checkPromo(values.promoCode), [values.promoCode]);
  const activePromo = promoCheck.status === "valid" ? promoCheck.promo : null;

  const price = useMemo(
    () => computePrice(tripSummary.price, values.ageCategory, activePromo),
    [tripSummary.price, values.ageCategory, activePromo]
  );

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
    if (promoCheck.status === "invalid") {
      next.promoCode = "This promo code doesn't exist.";
    }
    if (!values.agree) {
      next.agree = "Please accept the terms to continue.";
    }
    return next;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    setSubmitError(null);
    if (Object.keys(found).length > 0) return;

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

      setConfirmation({
        reference: data.booking.reference,
        carrierReference: data.carrierReference,
        totalPaid: data.booking.totalPaid,
        status: data.booking.status,
        finalPrice: data.booking.finalPrice ?? data.booking.basePrice ?? 0,
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
          <SummaryRow
            label="When"
            value={`${tripSummary.departure} → ${tripSummary.arrival}`}
          />
          <SummaryRow label="Carrier" value={tripSummary.carrier} />
          <SummaryRow label="Status" value={confirmation.status} />
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
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
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
      onSubmit={handleSubmit}
      noValidate
      className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8"
    >
      <h2 className="text-lg font-semibold text-slate-900">Passenger details</h2>
      <p className="mt-1 text-sm text-slate-500">
        Please enter the primary passenger&apos;s information.
      </p>

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
          label="Email (optional)"
          type="email"
          placeholder="you@example.com"
          value={values.email}
          onChange={(e) => setField("email", e.target.value)}
          error={errors.email}
          autoComplete="email"
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
      </div>

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
              placeholder={PROMO_CODES[0]?.code ?? "PROMO"}
              aria-invalid={errors.promoCode ? "true" : undefined}
              className={`h-12 w-full rounded-xl border bg-slate-50 px-3 pr-28 text-sm uppercase tracking-wider text-slate-900 placeholder:text-slate-400 placeholder:normal-case transition focus:bg-white focus:outline-none focus:ring-2 ${
                promoCheck.status === "invalid"
                  ? "border-rose-300 focus:border-rose-400 focus:ring-rose-200"
                  : promoCheck.status === "valid"
                    ? "border-emerald-300 focus:border-emerald-400 focus:ring-emerald-200"
                    : "border-slate-200 focus:border-brand-400 focus:ring-brand-200"
              }`}
            />
            <span
              className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-[11px] font-semibold ${
                promoCheck.status === "valid"
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100"
                  : promoCheck.status === "invalid"
                    ? "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-100"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              {promoCheck.status === "valid"
                ? promoBadge(promoCheck.promo)
                : promoCheck.status === "invalid"
                  ? "invalid"
                  : "—"}
            </span>
          </div>
        </label>
        {promoCheck.status === "valid" ? (
          <p className="mt-1 text-xs text-emerald-700">
            Applied: {promoCheck.promo.label}
          </p>
        ) : errors.promoCode ? (
          <p className="mt-1 text-xs text-rose-600">{errors.promoCode}</p>
        ) : (
          <p className="mt-1 text-xs text-slate-400">
            Try{" "}
            {PROMO_CODES.map((p, i) => (
              <span key={p.code}>
                {i > 0 ? ", " : ""}
                <code>{p.code}</code>
              </span>
            ))}
            .
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

      <div className="mt-8 flex flex-col gap-3 border-t border-dashed border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          No real payment is processed. This is a demo booking flow.
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? (
            <>
              <Spinner className="h-4 w-4" />
              Confirming…
            </>
          ) : (
            <>
              Pay €{price.total.toFixed(2)}
              <ArrowRightIcon className="h-4 w-4" />
            </>
          )}
        </button>
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
}: {
  basePrice: number;
  ageDiscount: number;
  ageLabel: string;
  promoDiscount: number;
  promoCode?: string;
  serviceFee: number;
  finalPrice: number;
  total: number;
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
}: FieldProps) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={error ? "true" : undefined}
        className={`h-12 w-full rounded-xl border bg-slate-50 px-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:bg-white focus:outline-none focus:ring-2 ${
          error
            ? "border-rose-300 focus:border-rose-400 focus:ring-rose-200"
            : "border-slate-200 focus:border-brand-400 focus:ring-brand-200"
        }`}
      />
      {error ? (
        <span className="mt-1 block text-xs text-rose-600">{error}</span>
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
