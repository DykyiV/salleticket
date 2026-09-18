"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AGE_CATEGORIES,
  computePrice,
  type AgeCategoryId,
} from "@/lib/pricing";
import { AGE_LABEL } from "@/lib/tickets/labels";
import { parseTripKind, type TripKindId } from "@/lib/tickets/kinds";
import { TRIP_KIND_LABEL } from "@/lib/tickets/labels";
import { getBookingSessionId } from "@/lib/seatSession";

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

type PassengerForm = {
  firstName: string;
  lastName: string;
  ageCategory: AgeCategoryId;
  promoCode: string;
  promoState: PromoState;
};

type Props = {
  tripSummary: TripSummary;
  currentUser?: CurrentUser | null;
  tripKind?: TripKindId;
  returnDate?: string;
  seats?: number[];
  returnSeats?: number[];
  returnTripId?: string;
  returnPrice?: number;
  passengersCount?: number;
};

type Confirmation = {
  references: string[];
  groupRef?: string;
  totalPaid: number;
  status: string;
  paymentMethod: "CASH_ON_BUS" | "ONLINE";
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function emptyPassenger(): PassengerForm {
  return {
    firstName: "",
    lastName: "",
    ageCategory: "ADULT",
    promoCode: "",
    promoState: { status: "empty" },
  };
}

export default function BookingForm({
  tripSummary,
  currentUser,
  tripKind: tripKindProp,
  seats = [],
  returnSeats = [],
  returnTripId,
  returnPrice = 0,
  passengersCount,
}: Props) {
  const router = useRouter();
  const isAuthed = Boolean(currentUser);
  const tripKind = parseTripKind(tripKindProp);
  const count = Math.max(1, passengersCount ?? seats.length ?? 1);

  const [loginHref, setLoginHref] = useState("/login");
  useEffect(() => {
    const next = window.location.pathname + window.location.search;
    setLoginHref(`/login?next=${encodeURIComponent(next)}`);
  }, []);

  const [passengers, setPassengers] = useState<PassengerForm[]>(() =>
    Array.from({ length: count }, emptyPassenger)
  );
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(currentUser?.email ?? "");
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [sessionId, setSessionId] = useState("server");
  const [salesSettings, setSalesSettings] = useState({
    onlineDiscountPercent: 0,
    paymentDeadlineHours: 24,
  });

  useEffect(() => {
    setSessionId(getBookingSessionId());
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

  const legsPrice = tripSummary.price + (tripKind === "ROUND_TRIP" ? returnPrice : 0);

  const setPassenger = <K extends keyof PassengerForm>(
    index: number,
    field: K,
    value: PassengerForm[K]
  ) => {
    setPassengers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  // Debounced per-passenger promo / discount-card check.
  useEffect(() => {
    const timers: number[] = [];
    const controllers: AbortController[] = [];
    passengers.forEach((p, index) => {
      const raw = p.promoCode.trim();
      if (!raw) {
        if (p.promoState.status !== "empty") {
          setPassenger(index, "promoState", { status: "empty" });
        }
        return;
      }
      if (
        p.promoState.status === "valid" &&
        p.promoState.promo.code === raw.toUpperCase()
      ) {
        return;
      }
      const ac = new AbortController();
      controllers.push(ac);
      timers.push(
        window.setTimeout(async () => {
          setPassenger(index, "promoState", { status: "checking" });
          try {
            const res = await fetch(
              `/api/promo/check?code=${encodeURIComponent(raw)}`,
              { signal: ac.signal }
            );
            const data = (await res.json()) as
              | { ok: true; promo: PromoPreview }
              | { ok: false; reason: string; message: string };
            if (data.ok) {
              setPassenger(index, "promoState", {
                status: "valid",
                promo: data.promo,
              });
            } else {
              setPassenger(index, "promoState", {
                status: "invalid",
                message: data.message,
              });
            }
          } catch {
            // aborted
          }
        }, 250)
      );
    });
    return () => {
      controllers.forEach((ac) => ac.abort());
      timers.forEach((t) => window.clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passengers.map((p) => p.promoCode).join("|")]);

  const perPassenger = useMemo(
    () =>
      passengers.map((p) => {
        const promo =
          p.promoState.status === "valid"
            ? ({
                id: p.promoState.promo.code,
                code: p.promoState.promo.code,
                type: p.promoState.promo.type ?? "PERCENT",
                percent: p.promoState.promo.percent,
                amount: p.promoState.promo.amount ?? null,
                label: p.promoState.promo.label,
                isActive: true,
                startsAt: null,
                endsAt: null,
                usageLimit: null,
                usedCount: 0,
                userId: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              } as const)
            : null;
        return computePrice(legsPrice, p.ageCategory, promo);
      }),
    [passengers, legsPrice]
  );

  const ticketsTotal = round2(
    perPassenger.reduce((sum, p) => sum + p.finalPrice, 0)
  );
  const feesTotal = round2(perPassenger.length * 1.5);
  const total = round2(ticketsTotal + feesTotal);
  const onlineTicketsTotal = round2(
    ticketsTotal * (1 - Math.min(100, salesSettings.onlineDiscountPercent) / 100)
  );
  const onlineTotal = round2(onlineTicketsTotal + feesTotal);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    passengers.forEach((p, i) => {
      if (!p.firstName.trim()) next[`p${i}-firstName`] = "Вкажіть імʼя";
      if (!p.lastName.trim()) next[`p${i}-lastName`] = "Вкажіть прізвище";
      if (p.promoState.status === "invalid") {
        next[`p${i}-promo`] = p.promoState.message;
      }
      if (p.promoState.status === "checking") {
        next[`p${i}-promo`] = "Перевіряємо код…";
      }
    });
    if (phone.replace(/\D/g, "").length < 7) {
      next.phone = "Вкажіть телефон";
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      next.email = "Некоректний email";
    }
    if (!agree) next.agree = "Підтвердіть згоду з умовами";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (paymentMethod: "CASH_ON_BUS" | "ONLINE") => {
    setSubmitError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: tripSummary.tripId ?? "unknown",
          carrierId: tripSummary.carrierId ?? "mock",
          tripKind,
          paymentMethod,
          holdSessionId: sessionId,
          returnTripId: tripKind === "ROUND_TRIP" ? returnTripId : undefined,
          contact: { phone: phone.trim(), email: email.trim() || undefined },
          passengers: passengers.map((p, i) => ({
            firstName: p.firstName.trim(),
            lastName: p.lastName.trim(),
            ageCategory: p.ageCategory,
            promoCode:
              p.promoState.status === "valid" ? p.promoCode.trim() : undefined,
            seatNumber: seats[i] ?? null,
            returnSeatNumber:
              tripKind === "ROUND_TRIP" ? (returnSeats[i] ?? null) : null,
          })),
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

      if (paymentMethod === "ONLINE" && data.booking.payment?.payUrl) {
        router.push(data.booking.payment.payUrl as string);
        return;
      }

      setConfirmation({
        references: (data.booking.passengers ?? []).map(
          (p: { reference: string }) => p.reference
        ),
        groupRef: data.booking.groupRef,
        totalPaid: data.booking.totalPaid,
        status: data.booking.status,
        paymentMethod,
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Щось пішло не так. Спробуйте ще."
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
              Бронювання створено
            </h2>
            <p className="text-sm text-slate-500">
              Оплата в автобусі при посадці. Квитки вже в кабінеті.
            </p>
          </div>
        </div>

        <dl className="mt-6 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
          {confirmation.references.map((ref, i) => (
            <div key={ref} className="flex items-center justify-between">
              <dt className="text-slate-500">
                Пасажир {i + 1}
                {seats[i] != null ? ` · місце ${seats[i]}` : ""}
              </dt>
              <dd className="font-mono font-medium tracking-wider text-slate-900">
                {ref}
              </dd>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-slate-200 pt-2">
            <dt className="font-medium text-slate-900">До сплати в автобусі</dt>
            <dd className="text-lg font-bold tabular-nums">
              €{confirmation.totalPaid.toFixed(2)}
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap gap-2">
          <a
            href={`/cabinet/tickets/${confirmation.references[0] ?? ""}`}
            className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Відкрити квиток
          </a>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
          >
            Ще одне бронювання
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
      <h2 className="text-lg font-semibold text-slate-900">Дані пасажирів</h2>
      <p className="mt-1 text-sm text-slate-500">
        {TRIP_KIND_LABEL[tripKind]} · {tripSummary.from} → {tripSummary.to}
        {tripSummary.date ? ` · ${tripSummary.date}` : ""}
      </p>

      {isAuthed ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <UserIcon className="h-4 w-4 shrink-0" />
          <span className="min-w-0 truncate">
            Ви увійшли як{" "}
            <span className="font-semibold">{currentUser!.email}</span>
          </span>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900">
          <span>Увійдіть, щоб зберегти квитки в кабінеті.</span>
          <a
            href={loginHref}
            className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-brand-700"
          >
            Увійти
          </a>
        </div>
      )}

      <div className="mt-6 space-y-5">
        {passengers.map((p, i) => (
          <section
            key={i}
            className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                Пасажир {i + 1}
              </h3>
              <span className="text-xs text-slate-500">
                {seats[i] != null ? `Місце ${seats[i]}` : "Без місця"}
                {tripKind === "ROUND_TRIP" && returnSeats[i] != null
                  ? ` · назад ${returnSeats[i]}`
                  : ""}
                {" · "}
                <span className="font-semibold tabular-nums text-slate-900">
                  €{perPassenger[i].finalPrice.toFixed(2)}
                </span>
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                id={`p${i}-firstName`}
                label="Імʼя"
                placeholder="Олена"
                value={p.firstName}
                onChange={(e) => setPassenger(i, "firstName", e.target.value)}
                error={errors[`p${i}-firstName`]}
                required
              />
              <Field
                id={`p${i}-lastName`}
                label="Прізвище"
                placeholder="Коваленко"
                value={p.lastName}
                onChange={(e) => setPassenger(i, "lastName", e.target.value)}
                error={errors[`p${i}-lastName`]}
                required
              />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Вікова знижка
                </span>
                <AgeDiscountSelect
                  value={p.ageCategory}
                  onChange={(v) => setPassenger(i, "ageCategory", v)}
                />
              </div>
              <div>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Дисконтна карта / реф. код
                </span>
                <input
                  type="text"
                  value={p.promoCode}
                  onChange={(e) =>
                    setPassenger(i, "promoCode", e.target.value.toUpperCase())
                  }
                  placeholder="DISCOUNT10"
                  className={`h-12 w-full rounded-xl border bg-white px-3 text-sm uppercase tracking-wider text-slate-900 placeholder:text-slate-400 placeholder:normal-case transition focus:outline-none focus:ring-2 ${
                    p.promoState.status === "invalid"
                      ? "border-rose-300 focus:ring-rose-200"
                      : p.promoState.status === "valid"
                        ? "border-emerald-300 focus:ring-emerald-200"
                        : "border-slate-200 focus:border-brand-400 focus:ring-brand-200"
                  }`}
                />
                {p.promoState.status === "valid" ? (
                  <p className="mt-1 text-xs text-emerald-700">
                    Застосовано
                    {p.promoState.promo.label
                      ? ` — ${p.promoState.promo.label}`
                      : ""}
                  </p>
                ) : p.promoState.status === "invalid" ? (
                  <p className="mt-1 text-xs text-rose-600">
                    {p.promoState.message}
                  </p>
                ) : null}
                {errors[`p${i}-promo`] ? (
                  <p className="mt-1 text-xs text-rose-600">
                    {errors[`p${i}-promo`]}
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          id="phone"
          label="Контактний телефон"
          type="tel"
          placeholder="+380 99 123 45 67"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={errors.phone}
          required
        />
        <Field
          id="email"
          label={isAuthed ? "Email (ваш акаунт)" : "Email"}
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          readOnly={isAuthed}
        />
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <dl className="space-y-1.5 text-sm">
          {passengers.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-slate-600">
              <dt>
                Пасажир {i + 1} · {AGE_LABEL[p.ageCategory] ?? p.ageCategory}
                {perPassenger[i].ageDiscount > 0
                  ? ` (−€${perPassenger[i].ageDiscount.toFixed(2)})`
                  : ""}
                {perPassenger[i].promoDiscount > 0
                  ? ` · промо −€${perPassenger[i].promoDiscount.toFixed(2)}`
                  : ""}
              </dt>
              <dd className="tabular-nums">
                €{perPassenger[i].finalPrice.toFixed(2)}
              </dd>
            </div>
          ))}
          <div className="flex items-center justify-between text-slate-600">
            <dt>Сервісний збір × {passengers.length}</dt>
            <dd className="tabular-nums">€{feesTotal.toFixed(2)}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-2">
            <dt className="font-semibold text-slate-900">Разом</dt>
            <dd className="text-xl font-extrabold tabular-nums text-slate-900">
              €{total.toFixed(2)}
            </dd>
          </div>
          {salesSettings.onlineDiscountPercent > 0 ? (
            <div className="flex items-center justify-between text-emerald-700">
              <dt>Онлайн-оплата (−{salesSettings.onlineDiscountPercent}%)</dt>
              <dd className="tabular-nums font-semibold">
                €{onlineTotal.toFixed(2)}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      <label className="mt-6 flex items-start gap-2.5 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <span>
          Погоджуюсь з умовами перевезення та договором оферти.
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
          Оберіть спосіб завершення бронювання. Місця вже закріплені за вами.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => submit("CASH_ON_BUS")}
            disabled={submitting}
            className="inline-flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-brand-300 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <>
                <span>Забронювати · оплата в автобусі</span>
                <span className="text-base font-bold tabular-nums">
                  €{total.toFixed(2)}
                </span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => submit("ONLINE")}
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
                  {onlineTotal < total ? (
                    <span className="ml-1.5 align-middle text-xs font-medium text-brand-100 line-through">
                      €{total.toFixed(2)}
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
    </div>
  );
}

function AgeDiscountSelect({
  value,
  onChange,
}: {
  value: AgeCategoryId;
  onChange: (value: AgeCategoryId) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = AGE_CATEGORIES.find((c) => c.id === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left text-sm text-slate-900 transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
      >
        <span>
          {AGE_LABEL[value] ?? value}
          <span className="ml-2 text-xs text-slate-500">
            {current?.discount
              ? `−${Math.round(current.discount * 100)}%`
              : "без знижки"}
          </span>
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {AGE_CATEGORIES.map((cat) => (
            <li key={cat.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(cat.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-brand-50 ${
                  cat.id === value
                    ? "bg-brand-50 font-medium text-brand-900"
                    : "text-slate-700"
                }`}
              >
                <span>{AGE_LABEL[cat.id] ?? cat.label}</span>
                <span className="text-xs text-slate-500">
                  {cat.discount > 0
                    ? `−${Math.round(cat.discount * 100)}%`
                    : "без знижки"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
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
  required?: boolean;
  readOnly?: boolean;
};

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  required,
  readOnly,
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
        readOnly={readOnly}
        aria-invalid={error ? "true" : undefined}
        className={`h-12 w-full rounded-xl border px-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 ${
          readOnly
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-600"
            : "bg-white"
        } ${
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
