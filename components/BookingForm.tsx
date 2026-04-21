"use client";

import { useState, type FormEvent } from "react";

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
};

type Values = {
  name: string;
  phone: string;
  email: string;
  agree: boolean;
};

type Errors = Partial<Record<keyof Values, string>>;

export default function BookingForm({ tripSummary }: Props) {
  const [values, setValues] = useState<Values>({
    name: "",
    phone: "",
    email: "",
    agree: false,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(
    null
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange =
    (field: keyof Values) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value =
        e.target.type === "checkbox" ? e.target.checked : e.target.value;
      setValues((prev) => ({ ...prev, [field]: value as never }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  const validate = (): Errors => {
    const next: Errors = {};
    if (!values.name.trim() || values.name.trim().length < 2) {
      next.name = "Please enter your full name.";
    }
    const phoneDigits = values.phone.replace(/\D/g, "");
    if (phoneDigits.length < 7) {
      next.phone = "Please enter a valid phone number.";
    }
    if (values.email && !/^\S+@\S+\.\S+$/.test(values.email)) {
      next.email = "Please enter a valid email address.";
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
          passenger: {
            name: values.name.trim(),
            phone: values.phone.trim(),
            email: values.email.trim() || undefined,
          },
          tripSnapshot: {
            from: tripSummary.from,
            to: tripSummary.to,
            departure: tripSummary.departure,
            arrival: tripSummary.arrival,
            price: tripSummary.price,
            currency: "EUR",
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Booking failed");
      }

      setConfirmation({
        reference: data.booking.reference,
        carrierReference: data.carrierReference,
        totalPaid: data.booking.totalPaid,
        status: data.booking.status,
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmation) {
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
          <SummaryRow label="Passenger" value={values.name} />
          <SummaryRow label="Phone" value={values.phone} />
          {values.email ? (
            <SummaryRow label="Email" value={values.email} />
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
          <SummaryRow
            label="Status"
            value={confirmation.status}
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
        <div className="sm:col-span-2">
          <Field
            id="name"
            label="Full name"
            placeholder="John Doe"
            value={values.name}
            onChange={handleChange("name")}
            error={errors.name}
            autoComplete="name"
            required
          />
        </div>

        <Field
          id="phone"
          label="Phone"
          type="tel"
          placeholder="+380 99 123 45 67"
          value={values.phone}
          onChange={handleChange("phone")}
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
          onChange={handleChange("email")}
          error={errors.email}
          autoComplete="email"
        />
      </div>

      <label className="mt-6 flex items-start gap-2.5 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={values.agree}
          onChange={handleChange("agree")}
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
              Confirm booking
              <ArrowRightIcon className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </form>
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
