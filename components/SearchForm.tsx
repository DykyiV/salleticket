"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type TransportType = "BUS" | "FLIGHT" | "TRAIN";

type SearchValues = {
  from: string;
  to: string;
  date: string;
};

const TRANSPORT_OPTIONS: {
  id: TransportType;
  label: string;
  icon: (className: string) => React.ReactNode;
}[] = [
  { id: "BUS", label: "Bus", icon: (c) => <BusIcon className={c} /> },
  { id: "FLIGHT", label: "Flight", icon: (c) => <PlaneIcon className={c} /> },
  { id: "TRAIN", label: "Train", icon: (c) => <TrainIcon className={c} /> },
];

const POPULAR_CITIES = [
  "Kyiv",
  "Lviv",
  "Odesa",
  "Kharkiv",
  "Dnipro",
  "Warsaw",
  "Prague",
  "Berlin",
];

export default function SearchForm() {
  const router = useRouter();
  const [transport, setTransport] = useState<TransportType>("BUS");
  const [values, setValues] = useState<SearchValues>({
    from: "",
    to: "",
    date: "",
  });

  const handleChange = (field: keyof SearchValues) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setValues((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSwap = () => {
    setValues((prev) => ({ ...prev, from: prev.to, to: prev.from }));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set("transport", transport);
    if (values.from) params.set("from", values.from);
    if (values.to) params.set("to", values.to);
    if (values.date) params.set("date", values.date);
    const qs = params.toString();
    router.push(qs ? `/results?${qs}` : "/results");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-200/80 sm:p-6"
    >
      <div
        role="tablist"
        aria-label="Transport type"
        className="mb-4 inline-flex rounded-xl bg-slate-100 p-1"
      >
        {TRANSPORT_OPTIONS.map((option) => {
          const active = transport === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTransport(option.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-white text-brand-700 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {option.icon("h-4 w-4")}
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr_1fr_auto] md:items-end">
        <Field
          id="from"
          label="From"
          placeholder="Departure city"
          value={values.from}
          onChange={handleChange("from")}
          list="cities"
          icon={<PinIcon className="h-5 w-5 text-slate-400" />}
        />

        <button
          type="button"
          onClick={handleSwap}
          aria-label="Swap cities"
          className="mx-auto hidden h-11 w-11 shrink-0 items-center justify-center self-end rounded-full border border-slate-200 bg-white text-slate-500 transition hover:rotate-180 hover:border-brand-300 hover:text-brand-600 md:flex"
        >
          <SwapIcon className="h-5 w-5" />
        </button>

        <Field
          id="to"
          label="To"
          placeholder="Arrival city"
          value={values.to}
          onChange={handleChange("to")}
          list="cities"
          icon={<PinIcon className="h-5 w-5 text-slate-400" />}
        />

        <Field
          id="date"
          label="Date"
          type="date"
          value={values.date}
          onChange={handleChange("date")}
          icon={<CalendarIcon className="h-5 w-5 text-slate-400" />}
        />

        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
        >
          <SearchIcon className="h-4 w-4" />
          Search tickets
        </button>
      </div>

      <datalist id="cities">
        {POPULAR_CITIES.map((city) => (
          <option key={city} value={city} />
        ))}
      </datalist>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-medium text-slate-600">Popular:</span>
        {["Kyiv → Lviv", "Odesa → Kyiv", "Warsaw → Lviv", "Kharkiv → Dnipro"].map(
          (item) => (
            <button
              key={item}
              type="button"
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            >
              {item}
            </button>
          )
        )}
      </div>
    </form>
  );
}

type FieldProps = {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  list?: string;
  icon?: React.ReactNode;
};

function Field({
  id,
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  list,
  icon,
}: FieldProps) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="relative flex items-center">
        {icon ? (
          <span className="pointer-events-none absolute left-3 flex items-center">
            {icon}
          </span>
        ) : null}
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          list={list}
          className={`h-12 w-full rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 ${
            icon ? "pl-10 pr-3" : "px-3"
          }`}
        />
      </span>
    </label>
  );
}

function PinIcon({ className }: { className?: string }) {
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
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
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
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
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
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function SwapIcon({ className }: { className?: string }) {
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
      <path d="M17 3 21 7l-4 4" />
      <path d="M3 7h18" />
      <path d="M7 21l-4-4 4-4" />
      <path d="M21 17H3" />
    </svg>
  );
}

function BusIcon({ className }: { className?: string }) {
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
      <path d="M8 6v6" />
      <path d="M16 6v6" />
      <path d="M2 12h19.6" />
      <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2V6c0-1.1-.9-2-2-2H4a2 2 0 0 0-2 2v8c0 .5.2 1 .6 1.4L4 18" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}

function PlaneIcon({ className }: { className?: string }) {
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
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  );
}

function TrainIcon({ className }: { className?: string }) {
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
      <rect width="16" height="16" x="4" y="3" rx="2" />
      <path d="M4 11h16" />
      <path d="M12 3v8" />
      <path d="m8 19-2 3" />
      <path d="m18 22-2-3" />
      <path d="M8 15h.01" />
      <path d="M16 15h.01" />
    </svg>
  );
}
