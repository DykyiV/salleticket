"use client";

import { useState, type FormEvent } from "react";

type SearchValues = {
  from: string;
  to: string;
  date: string;
};

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
    console.log("Search:", values);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-200/80 sm:p-6"
    >
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
