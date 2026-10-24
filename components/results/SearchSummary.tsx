"use client";

import { useState } from "react";
import Icon from "@/components/site/Icon";
import SearchPanel, { type SearchDefaults } from "@/components/home/SearchPanel";
import { useI18n } from "@/lib/i18n/client";

/** Route summary with a «Change search» toggle that reveals the search form. */
export default function SearchSummary({
  title,
  details,
  cities,
  today,
  defaults,
  initiallyOpen = false,
}: {
  title: string;
  details: string;
  cities: string[];
  today: string;
  defaults: SearchDefaults;
  initiallyOpen?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h1>
          <p className="mt-0.5 truncate text-sm text-blue-100/90">{details}</p>
        </div>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:px-4"
        >
          <Icon name={open ? "close" : "search"} className="h-4 w-4" />
          <span className="hidden sm:inline">{open ? t.results.closeSearch : t.results.editSearch}</span>
          <span className="sr-only sm:hidden">{open ? t.results.closeSearch : t.results.editSearch}</span>
        </button>
      </div>
      {open ? (
        <div className="mt-4">
          <SearchPanel cities={cities} quickRoutes={[]} today={today} defaults={defaults} />
        </div>
      ) : null}
    </div>
  );
}
