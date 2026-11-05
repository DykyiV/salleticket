"use client";

import { useId, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { cityLabel, citySuggestions } from "@/lib/trips/cities";

/**
 * City field with suggestions in any language: «Мюнхен», «Munich» and
 * «München» all find the same city; the list shows it in the site language.
 */
export default function CityInput({
  id,
  name,
  value,
  onChange,
  placeholder,
  className,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className: string;
}) {
  const { lang } = useI18n();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const items = open ? citySuggestions(value, lang) : [];
  // Nothing to suggest once the field holds exactly one picked city.
  const shown = items.length === 1 && items[0].label === value.trim() ? [] : items;

  const pick = (label: string) => {
    onChange(label);
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        role="combobox"
        aria-expanded={shown.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={shown.length ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          // A known city typed in another language → show it in the site language.
          const label = cityLabel(value.trim(), lang);
          if (value.trim() && label !== value.trim()) onChange(label);
        }}
        onKeyDown={(e) => {
          if (!shown.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % shown.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + shown.length) % shown.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(shown[Math.min(active, shown.length - 1)].label);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={className}
      />
      {shown.length ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 top-full z-40 mt-2 max-h-72 w-full min-w-[15rem] overflow-auto rounded-xl bg-white py-1 text-left shadow-lift ring-1 ring-slate-200"
        >
          {shown.map((c, i) => (
            <li
              key={c.uk}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: the input's blur would close the list first.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(c.label);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-brand-50 text-brand-800" : "text-navy"}`}
            >
              <span className="font-semibold">{c.label}</span>
              {c.alt ? <span className="ml-2 text-xs text-slate-500">{c.alt}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
